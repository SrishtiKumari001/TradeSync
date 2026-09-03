import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { challanApi } from "../api/endpoints";
import { getErrorMessage } from "../api/client";
import type { Challan, ChallanStatus } from "../types";
import { Alert, Button, Card, EmptyState, formatDate, formatMoney, Input, PageHeader, Pagination, Select, Spinner, StatusBadge } from "../components/ui";
import { useAuth, SALES_ROLES } from "../context/AuthContext";

export default function Challans() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = user && SALES_ROLES.includes(user.role as (typeof SALES_ROLES)[number]);

  const [challans, setChallans] = useState<Challan[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError("");
    try {
      const res = await challanApi.list({ search: search || undefined, status: status || undefined, page, pageSize: 20 });
      setChallans(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(() => load(1), 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Sales Challans"
        subtitle="Drafts, confirmed deliveries and cancellations"
        actions={canCreate ? <Button onClick={() => navigate("/challans/new")}>+ New challan</Button> : undefined}
      />

      <Card className="mb-4 p-3">
        <div className="grid gap-3 md:grid-cols-4">
          <Input placeholder="Search challan number (CHL-0001) or customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setSearchParams(e.target.value ? { status: e.target.value } : {}); }}>
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
          <Button variant="secondary" onClick={() => { setSearch(""); setStatus(""); setSearchParams({}); }}>Clear filters</Button>
        </div>
      </Card>

      {error && <Alert className="mb-4">{error}</Alert>}

      <Card>
        {loading ? (
          <Spinner />
        ) : challans.length === 0 ? (
          <EmptyState message="No challans found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Challan</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Total qty</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {challans.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/challans/${c.id}`} className="font-medium text-indigo-600 hover:underline">
                        {c.challanNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.customer?.name}</td>
                    <td className="px-4 py-3 text-slate-600">{c._count?.items ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.totalQuantity}</td>
                    <td className="px-4 py-3 text-slate-600">{formatMoney(c.totalAmount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{c.createdBy?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={load} />
    </div>
  );
}
