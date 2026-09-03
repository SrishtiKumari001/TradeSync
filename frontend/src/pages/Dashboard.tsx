import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dashboardApi } from "../api/endpoints";
import { getErrorMessage } from "../api/client";
import type { DashboardSummary } from "../types";
import { Alert, Card, EmptyState, formatMoney, PageHeader, Spinner, StatusBadge } from "../components/ui";

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi
      .summary()
      .then(setSummary)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading dashboard..." />;
  if (error) return <Alert>{error}</Alert>;
  if (!summary) return null;

  const { metrics } = summary;
  const kpis = [
    { label: "Customers", value: metrics.customers, to: "/customers" },
    { label: "Active customers", value: metrics.activeCustomers, to: "/customers" },
    { label: "Products", value: metrics.products, to: "/products" },
    { label: "Low stock alerts", value: metrics.lowStockCount, to: "/products?lowStock=true" },
    { label: "Draft challans", value: metrics.draftChallans, to: "/challans?status=DRAFT" },
    { label: "Confirmed challans", value: metrics.confirmedChallans, to: "/challans?status=CONFIRMED" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of customers, stock and recent challans" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <Link key={kpi.label} to={kpi.to}>
            <Card className="p-4 transition hover:shadow-md">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{kpi.label}</p>
              <p className={`mt-1 text-2xl font-bold ${kpi.value > 0 ? "text-slate-900" : "text-slate-400"}`}>{kpi.value}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Low stock products</h2>
            <Link to="/products?lowStock=true" className="text-sm font-medium text-indigo-600 hover:underline">
              View all
            </Link>
          </div>
          {summary.lowStockProducts.length === 0 ? (
            <EmptyState message="All products are above their minimum stock levels." />
          ) : (
            <div className="space-y-3">
              {summary.lowStockProducts.map((p) => (
                <Link key={p.id} to={`/products/${p.id}`} className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 transition hover:bg-red-100">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.sku}</p>
                  </div>
                  <p className="text-sm font-semibold text-red-700">
                    {p.currentStock} / {p.minStockAlert}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent challans</h2>
            <Link to="/challans" className="text-sm font-medium text-indigo-600 hover:underline">
              View all
            </Link>
          </div>
          {summary.recentChallans.length === 0 ? (
            <EmptyState message="No challans yet." />
          ) : (
            <div className="space-y-3">
              {summary.recentChallans.map((c) => (
                <Link key={c.id} to={`/challans/${c.id}`} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 transition hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {c.challanNumber} · {c.customer}
                    </p>
                    <p className="text-xs text-slate-500">
                      {c.itemCount} item{c.itemCount === 1 ? "" : "s"} · {formatMoney(c.totalAmount)}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
