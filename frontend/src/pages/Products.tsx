import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { productApi } from "../api/endpoints";
import { getErrorMessage } from "../api/client";
import type { Product } from "../types";
import { Alert, Badge, Button, Card, EmptyState, formatMoney, Input, Label, PageHeader, Pagination, Select, Spinner } from "../components/ui";
import { useAuth, WAREHOUSE_ROLES } from "../context/AuthContext";

const emptyForm = { name: "", sku: "", category: "", unitPrice: "", currentStock: "", minStockAlert: "", location: "" };

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const canWrite = user && WAREHOUSE_ROLES.includes(user.role as (typeof WAREHOUSE_ROLES)[number]);

  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(searchParams.get("lowStock") === "true");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError("");
    try {
      const res = await productApi.list({ search: search || undefined, category: category || undefined, lowStock: lowStockOnly || undefined, page, pageSize: 20 });
      setProducts(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, category, lowStockOnly]);

  useEffect(() => {
    const t = setTimeout(() => load(1), 300);
    return () => clearTimeout(t);
  }, [load]);

  const toggleLowStock = () => {
    const next = !lowStockOnly;
    setLowStockOnly(next);
    if (next) setSearchParams({ lowStock: "true" });
    else setSearchParams({});
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      category: p.category,
      unitPrice: String(p.unitPrice),
      currentStock: String(p.currentStock),
      minStockAlert: String(p.minStockAlert),
      location: p.location ?? "",
    });
    setFormError("");
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        category: form.category,
        unitPrice: Number(form.unitPrice),
        currentStock: Number(form.currentStock || 0),
        minStockAlert: Number(form.minStockAlert || 0),
        location: form.location || undefined,
      };
      if (editing) {
        await productApi.update(editing.id, payload);
      } else {
        await productApi.create(payload);
      }
      setShowForm(false);
      load(1);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Products & Inventory"
        subtitle="Catalogue, stock levels and low-stock alerts"
        actions={canWrite ? <Button onClick={openCreate}>+ Add product</Button> : undefined}
      />

      <Card className="mb-4 p-3">
        <div className="grid gap-3 md:grid-cols-4">
          <Input placeholder="Search name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Input placeholder="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={lowStockOnly} onChange={toggleLowStock} className="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
            Low stock only
          </label>
          <Button variant="secondary" onClick={() => { setSearch(""); setCategory(""); setLowStockOnly(false); setSearchParams({}); }}>
            Clear filters
          </Button>
        </div>
      </Card>

      {error && <Alert className="mb-4">{error}</Alert>}

      <Card>
        {loading ? (
          <Spinner />
        ) : products.length === 0 ? (
          <EmptyState message="No products found. Adjust filters or add a new product." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Unit price</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Alert level</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const low = p.currentStock <= p.minStockAlert;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link to={`/products/${p.id}`} className="font-medium text-indigo-600 hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.sku}</td>
                      <td className="px-4 py-3"><Badge color="slate">{p.category}</Badge></td>
                      <td className="px-4 py-3 text-slate-600">{formatMoney(p.unitPrice)}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${low ? "text-red-600" : "text-slate-900"}`}>{p.currentStock}</span>
                        {low && <Badge color="red" >low</Badge>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.minStockAlert}</td>
                      <td className="px-4 py-3 text-slate-600">{p.location ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {canWrite && <Button variant="ghost" onClick={() => openEdit(p)}>Edit</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={load} />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setShowForm(false)}>
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">{editing ? "Edit product" : "Add product"}</h2>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Product name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <Label>SKU / code *</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
              </div>
              <div>
                <Label>Category *</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
              </div>
              <div>
                <Label>Unit price (₹) *</Label>
                <Input type="number" step="0.01" min="0" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} required />
              </div>
              <div>
                <Label>Current stock</Label>
                <Input type="number" min="0" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })} />
              </div>
              <div>
                <Label>Min stock alert *</Label>
                <Input type="number" min="0" value={form.minStockAlert} onChange={(e) => setForm({ ...form, minStockAlert: e.target.value })} required />
              </div>
              <div>
                <Label>Location / warehouse</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              {formError && <Alert className="md:col-span-2">{formError}</Alert>}
              <div className="flex justify-end gap-2 md:col-span-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Add product"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
