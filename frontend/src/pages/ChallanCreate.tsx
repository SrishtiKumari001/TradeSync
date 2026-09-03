import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { challanApi, customerApi, productApi } from "../api/endpoints";
import { getErrorMessage } from "../api/client";
import type { Customer, Product } from "../types";
import { Alert, Button, Card, EmptyState, formatMoney, Input, Label, PageHeader, Select } from "../components/ui";

interface LineItem {
  productId: number;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
}

export default function ChallanCreate() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      customerApi.list({ page: 1, pageSize: 100 }).then((r) => r.data),
      productApi.list({ page: 1, pageSize: 100 }).then((r) => r.data),
    ])
      .then(([cs, ps]) => {
        setCustomers(cs);
        setProducts(ps);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const addProduct = useCallback(() => {
    const pid = Number(productId);
    if (!pid) return;
    const product = products.find((p) => p.id === pid);
    if (!product) return;
    const existing = items.find((i) => i.productId === pid);
    if (existing) {
      setItems(items.map((i) => (i.productId === pid ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      setItems([...items, { productId: pid, name: product.name, sku: product.sku, unitPrice: product.unitPrice, quantity: 1 }]);
    }
    setProductId("");
  }, [productId, products, items]);

  const setQuantity = (productId: number, quantity: number) => {
    setItems(items.map((i) => (i.productId === productId ? { ...i, quantity: Math.max(1, quantity) } : i)));
  };

  const totals = useMemo(
    () => ({
      quantity: items.reduce((s, i) => s + i.quantity, 0),
      amount: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    }),
    [items]
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!customerId) {
      setError("Please select a customer");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one product line item");
      return;
    }
    setSubmitting(true);
    try {
      const challan = await challanApi.create({
        customerId: Number(customerId),
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      navigate(`/challans/${challan.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader title="New challan" subtitle="Drafts are saved immediately — confirm only after finalising" actions={<Button variant="secondary" onClick={() => navigate("/challans")}>← Back</Button>} />

      {error && <Alert className="mb-4">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-5">
          <Label>Customer</Label>
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
            <option value="">Select customer...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.businessName ?? c.mobile}
              </option>
            ))}
          </Select>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1">
              <Label>Add product</Label>
              <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Select product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — {formatMoney(p.unitPrice)} · stock {p.currentStock}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="button" variant="secondary" onClick={addProduct} disabled={!productId}>+ Add line</Button>
          </div>

          {items.length === 0 ? (
            <EmptyState message="No line items yet. Pick a product above." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Unit price (snapshot)</th>
                    <th className="px-3 py-2 w-28">Qty</th>
                    <th className="px-3 py-2">Line total</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((i) => (
                    <tr key={i.productId}>
                      <td className="px-3 py-2 font-medium text-slate-900">{i.name}</td>
                      <td className="px-3 py-2 text-slate-600">{i.sku}</td>
                      <td className="px-3 py-2 text-slate-600">{formatMoney(i.unitPrice)}</td>
                      <td className="px-3 py-2">
                        <Input type="number" min="1" value={i.quantity} onChange={(e) => setQuantity(i.productId, Number(e.target.value))} />
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{formatMoney(i.unitPrice * i.quantity)}</td>
                      <td className="px-3 py-2 text-right">
                        <Button type="button" variant="ghost" onClick={() => setItems(items.filter((x) => x.productId !== i.productId))}>
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-sm">
            <span className="text-slate-500">
              Total quantity: <span className="font-semibold text-slate-900">{totals.quantity}</span>
            </span>
            <span className="text-slate-500">
              Total amount: <span className="text-base font-bold text-slate-900">{formatMoney(totals.amount)}</span>
            </span>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate("/challans")}>Cancel</Button>
          <Button type="submit" disabled={submitting || loading}>
            {submitting ? "Saving draft..." : "Save draft challan"}
          </Button>
        </div>
      </form>
    </div>
  );
}
