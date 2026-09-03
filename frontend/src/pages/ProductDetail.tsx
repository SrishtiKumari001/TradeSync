import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { productApi } from "../api/endpoints";
import { getErrorMessage } from "../api/client";
import type { Product, StockMovement } from "../types";
import { Alert, Badge, Button, Card, EmptyState, formatDateTime, formatMoney, Input, Label, PageHeader, Pagination, Select, Spinner } from "../components/ui";
import { useAuth, WAREHOUSE_ROLES } from "../context/AuthContext";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const productId = parseInt(id ?? "0", 10);
  const canAdjust = user && WAREHOUSE_ROLES.includes(user.role as (typeof WAREHOUSE_ROLES)[number]);

  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adjust, setAdjust] = useState({ movementType: "IN" as "IN" | "OUT", quantity: "", reason: "" });
  const [adjustError, setAdjustError] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [success, setSuccess] = useState("");

  const load = useCallback(async (page = 1) => {
    try {
      const [p, m] = await Promise.all([
        productApi.get(productId),
        productApi.stockMovements(productId, { page, pageSize: 10 }),
      ]);
      setProduct(p);
      setMovements(m.data);
      setPagination(m.pagination);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdjust = async (e: FormEvent) => {
    e.preventDefault();
    setAdjustError("");
    setSuccess("");
    setAdjusting(true);
    try {
      await productApi.adjustStock(productId, {
        movementType: adjust.movementType,
        quantity: Number(adjust.quantity),
        reason: adjust.reason.trim(),
      });
      setAdjust({ movementType: "IN", quantity: "", reason: "" });
      setSuccess("Stock updated");
      load(1);
    } catch (err) {
      setAdjustError(getErrorMessage(err));
    } finally {
      setAdjusting(false);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!product) return null;

  const low = product.currentStock <= product.minStockAlert;

  return (
    <div>
      <PageHeader
        title={product.name}
        subtitle={`${product.sku} · ${product.category}`}
        actions={<Button variant="secondary" onClick={() => navigate("/products")}>← Back</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="font-semibold text-slate-900">Stock & pricing</h2>
              {low ? <Badge color="red">Low stock</Badge> : <Badge color="green">In stock</Badge>}
            </div>
            <div className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-3">
              <div><dt className="text-slate-500">Unit price</dt><dd className="text-lg font-semibold text-slate-900">{formatMoney(product.unitPrice)}</dd></div>
              <div><dt className="text-slate-500">Current stock</dt><dd className={`text-lg font-semibold ${low ? "text-red-600" : "text-slate-900"}`}>{product.currentStock}</dd></div>
              <div><dt className="text-slate-500">Min alert level</dt><dd className="text-lg font-semibold text-slate-900">{product.minStockAlert}</dd></div>
              <div><dt className="text-slate-500">Location</dt><dd className="text-slate-900">{product.location ?? "—"}</dd></div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Stock movement history</h2>
            {movements.length === 0 ? (
              <EmptyState message="No stock movements recorded." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Qty change</th>
                      <th className="px-3 py-2">Reason</th>
                      <th className="px-3 py-2">By</th>
                      <th className="px-3 py-2">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td className="px-3 py-2">
                          {m.movementType === "IN" ? <Badge color="green">IN</Badge> : <Badge color="red">OUT</Badge>}
                        </td>
                        <td className={`px-3 py-2 font-semibold ${m.quantityChange > 0 ? "text-green-700" : "text-red-700"}`}>
                          {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {m.reason}
                          {m.challan && (
                            <Link to={`/challans/${m.challan.id}`} className="ml-1 text-indigo-600 hover:underline">
                              CHL-{String(m.challan.challanNumber).padStart(4, "0")}
                            </Link>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{m.createdBy?.name}</td>
                        <td className="px-3 py-2 text-slate-600">{formatDateTime(m.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={load} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Adjust stock</h2>
            {!canAdjust ? (
              <p className="text-sm text-slate-500">Only Warehouse and Admin roles can adjust stock.</p>
            ) : (
              <form onSubmit={handleAdjust} className="space-y-3">
                <div>
                  <Label>Type</Label>
                  <Select value={adjust.movementType} onChange={(e) => setAdjust({ ...adjust, movementType: e.target.value as "IN" | "OUT" })}>
                    <option value="IN">IN (receive)</option>
                    <option value="OUT">OUT (issue)</option>
                  </Select>
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" min="1" value={adjust.quantity} onChange={(e) => setAdjust({ ...adjust, quantity: e.target.value })} required />
                </div>
                <div>
                  <Label>Reason</Label>
                  <Input value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} placeholder="e.g. new batch received" required />
                </div>
                {adjustError && <Alert>{adjustError}</Alert>}
                {success && <Alert tone="success">{success}</Alert>}
                <Button type="submit" disabled={adjusting} className="w-full">{adjusting ? "Updating..." : "Update stock"}</Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
