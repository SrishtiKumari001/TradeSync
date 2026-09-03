import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { challanApi } from "../api/endpoints";
import { getErrorMessage } from "../api/client";
import type { Challan } from "../types";
import { Alert, Badge, Button, Card, EmptyState, formatDateTime, formatMoney, PageHeader, Spinner, StatusBadge } from "../components/ui";
import { useAuth, SALES_ROLES } from "../context/AuthContext";

export default function ChallanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const challanId = parseInt(id ?? "0", 10);
  const canManage = user && SALES_ROLES.includes(user.role as (typeof SALES_ROLES)[number]);

  const [challan, setChallan] = useState<Challan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      setChallan(await challanApi.get(challanId));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [challanId]);

  useEffect(() => {
    load();
  }, [load]);

  const confirm = async () => {
    if (!window.confirm("Confirm this challan? Stock will be deducted for all line items.")) return;
    setActing(true);
    try {
      const res = await challanApi.confirm(challanId);
      alert(res.message ?? "Challan confirmed");
      load();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setActing(false);
    }
  };

  const cancel = async () => {
    const willRestock = challan?.status === "CONFIRMED";
    if (!window.confirm(willRestock ? "Cancel this confirmed challan? Stock will be restored." : "Cancel this draft challan?")) return;
    setActing(true);
    try {
      const res = await challanApi.cancel(challanId);
      alert(res.message ?? "Challan cancelled");
      load();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setActing(false);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!challan) return null;

  return (
    <div>
      <PageHeader
        title={`Challan ${challan.challanNumber}`}
        subtitle={challan.customer ? `${challan.customer.name}${challan.customer.businessName ? ` · ${challan.customer.businessName}` : ""}` : ""}
        actions={<Button variant="secondary" onClick={() => navigate("/challans")}>← Back</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Line items</h2>
              <StatusBadge status={challan.status} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Product (as sold)</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Unit price</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {challan.items?.map((i) => (
                    <tr key={i.id}>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {i.productId ? (
                          <Link to={`/products/${i.productId}`} className="hover:underline">{i.productName}</Link>
                        ) : (
                          <span>{i.productName} <Badge color="red">deleted</Badge></span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{i.productSku}</td>
                      <td className="px-3 py-2 text-slate-600">{formatMoney(i.unitPrice)}</td>
                      <td className="px-3 py-2 text-slate-600">{i.quantity}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{formatMoney(i.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-sm">
              <span className="text-slate-500">
                Total quantity: <span className="font-semibold text-slate-900">{challan.totalQuantity}</span>
              </span>
              <span className="text-slate-500">
                Total amount: <span className="text-base font-bold text-slate-900">{formatMoney(challan.totalAmount)}</span>
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Prices and product details are snapshotted at the time the challan was created.
            </p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Details</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Status</dt><dd><StatusBadge status={challan.status} /></dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Created by</dt><dd className="text-slate-900">{challan.createdBy?.name}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Created</dt><dd className="text-slate-900">{formatDateTime(challan.createdAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Confirmed</dt><dd className="text-slate-900">{formatDateTime(challan.confirmedAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Cancelled</dt><dd className="text-slate-900">{formatDateTime(challan.cancelledAt)}</dd></div>
            </dl>
          </Card>

          {challan.status === "DRAFT" && canManage && (
            <Card className="p-5">
              <h2 className="mb-3 font-semibold text-slate-900">Actions</h2>
              <div className="space-y-2">
                <Button variant="success" onClick={confirm} disabled={acting} className="w-full">Confirm challan</Button>
                <Button variant="danger" onClick={cancel} disabled={acting} className="w-full">Cancel challan</Button>
              </div>
              <p className="mt-3 text-xs text-slate-400">Confirming deducts stock atomically; it fails entirely if any line has insufficient stock.</p>
            </Card>
          )}

          {challan.status === "CONFIRMED" && canManage && (
            <Card className="p-5">
              <h2 className="mb-3 font-semibold text-slate-900">Actions</h2>
              <Button variant="danger" onClick={cancel} disabled={acting} className="w-full">Cancel challan (restock)</Button>
              <p className="mt-3 text-xs text-slate-400">Cancelling a confirmed challan restores the deducted quantities to stock.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
