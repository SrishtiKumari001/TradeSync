import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { customerApi } from "../api/endpoints";
import { getErrorMessage } from "../api/client";
import type { Customer, CustomerStatus, CustomerType } from "../types";
import { Alert, Badge, Button, Card, EmptyState, formatDate, Input, Label, PageHeader, Pagination, Select, Spinner, StatusBadge, TextArea } from "../components/ui";

const emptyForm = {
  name: "",
  mobile: "",
  email: "",
  businessName: "",
  gstNumber: "",
  type: "WHOLESALE" as CustomerType,
  address: "",
  status: "LEAD" as CustomerStatus,
  followUpDate: "",
  notes: "",
};

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError("");
    try {
      const res = await customerApi.list({ search: search || undefined, type: type || undefined, status: status || undefined, page, pageSize: 20 });
      setCustomers(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, type, status]);

  useEffect(() => {
    const t = setTimeout(() => load(1), 300);
    return () => clearTimeout(t);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name,
      mobile: c.mobile,
      email: c.email ?? "",
      businessName: c.businessName ?? "",
      gstNumber: c.gstNumber ?? "",
      type: c.type,
      address: c.address ?? "",
      status: c.status,
      followUpDate: c.followUpDate ? c.followUpDate.slice(0, 10) : "",
      notes: c.notes ?? "",
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
        ...form,
        email: form.email || undefined,
        businessName: form.businessName || undefined,
        gstNumber: form.gstNumber || undefined,
        address: form.address || undefined,
        followUpDate: form.followUpDate ? new Date(form.followUpDate).toISOString() : undefined,
        notes: form.notes || undefined,
      };
      if (editing) {
        await customerApi.update(editing.id, payload);
      } else {
        await customerApi.create(payload);
      }
      setShowForm(false);
      load(1);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const typeBadgeColor: Record<CustomerType, string> = { RETAIL: "blue", WHOLESALE: "green", DISTRIBUTOR: "violet" };

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="CRM contacts with follow-up tracking"
        actions={<Button onClick={openCreate}>+ Add customer</Button>}
      />

      <Card className="mb-4 p-3">
        <div className="grid gap-3 md:grid-cols-4">
          <Input placeholder="Search name, mobile, email or business..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            <option value="RETAIL">Retail</option>
            <option value="WHOLESALE">Wholesale</option>
            <option value="DISTRIBUTOR">Distributor</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="LEAD">Lead</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
          <Button variant="secondary" onClick={() => { setSearch(""); setType(""); setStatus(""); load(1); }}>
            Clear filters
          </Button>
        </div>
      </Card>

      {error && <Alert className="mb-4">{error}</Alert>}

      <Card>
        {loading ? (
          <Spinner />
        ) : customers.length === 0 ? (
          <EmptyState message="No customers found. Adjust filters or add a new customer." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Follow-up</th>
                  <th className="px-4 py-3">Added</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/customers/${c.id}`} className="font-medium text-indigo-600 hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.businessName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.mobile}</td>
                    <td className="px-4 py-3"><Badge color={typeBadgeColor[c.type]}>{c.type}</Badge></td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(c.followUpDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" onClick={() => openEdit(c)}>Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={load} />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setShowForm(false)}>
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">{editing ? "Edit customer" : "Add customer"}</h2>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <Label>Mobile *</Label>
                <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} required />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Business name</Label>
                <Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
              </div>
              <div>
                <Label>GST number</Label>
                <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CustomerType })}>
                  <option value="RETAIL">Retail</option>
                  <option value="WHOLESALE">Wholesale</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Address</Label>
                <TextArea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CustomerStatus })}>
                  <option value="LEAD">Lead</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </div>
              <div>
                <Label>Follow-up date</Label>
                <Input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>Notes</Label>
                <TextArea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              {formError && <Alert className="md:col-span-2">{formError}</Alert>}
              <div className="flex justify-end gap-2 md:col-span-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Add customer"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
