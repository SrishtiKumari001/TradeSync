import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { customerApi } from "../api/endpoints";
import { getErrorMessage } from "../api/client";
import type { Customer, FollowUp } from "../types";
import { Alert, Badge, Button, Card, EmptyState, formatDateTime, Input, Label, PageHeader, Spinner, StatusBadge, TextArea } from "../components/ui";
import { useAuth } from "../context/AuthContext";

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const customerId = parseInt(id ?? "0", 10);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, f] = await Promise.all([customerApi.get(customerId), customerApi.followUps(customerId)]);
      setCustomer(c);
      setFollowUps(f);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  const addNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setAddingNote(true);
    try {
      await customerApi.addFollowUp(customerId, note.trim());
      setNote("");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!customer) return null;

  return (
    <div>
      <PageHeader
        title={customer.name}
        subtitle={customer.businessName ?? customer.email ?? customer.mobile}
        actions={<Button variant="secondary" onClick={() => navigate("/customers")}>← Back</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Contact details</h2>
              <div className="flex gap-2">
                <StatusBadge status={customer.status} />
                <Badge color="blue">{customer.type}</Badge>
              </div>
            </div>
            <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
              <div><dt className="text-slate-500">Mobile</dt><dd className="font-medium text-slate-900">{customer.mobile}</dd></div>
              <div><dt className="text-slate-500">Email</dt><dd className="text-slate-900">{customer.email ?? "—"}</dd></div>
              <div><dt className="text-slate-500">GST number</dt><dd className="text-slate-900">{customer.gstNumber ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Address</dt><dd className="text-slate-900">{customer.address ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Follow-up date</dt><dd className="text-slate-900">{formatDateTime(customer.followUpDate)}</dd></div>
              <div><dt className="text-slate-500">Added by</dt><dd className="text-slate-900">{customer.createdBy?.name ?? "—"}</dd></div>
              <div className="md:col-span-2"><dt className="text-slate-500">Notes</dt><dd className="whitespace-pre-wrap text-slate-900">{customer.notes ?? "—"}</dd></div>
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Follow-ups</h2>
            <form onSubmit={addNote} className="mb-4 flex gap-2">
              <Input placeholder="Add a follow-up note..." value={note} onChange={(e) => setNote(e.target.value)} />
              <Button type="submit" disabled={addingNote || !note.trim()}>Add note</Button>
            </form>
            {followUps.length === 0 ? (
              <EmptyState message="No follow-ups recorded yet." />
            ) : (
              <div className="space-y-3">
                {followUps.map((f) => (
                  <div key={f.id} className="rounded-md border border-slate-200 p-3">
                    <p className="text-sm text-slate-800">{f.note}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {f.createdBy?.name} · {formatDateTime(f.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="h-fit p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Quick actions</h2>
          <div className="space-y-2 text-sm">
            <p className="text-slate-500">Added {formatDateTime(customer.createdAt)} by {customer.createdBy?.name}</p>
            <p className="text-slate-500">Created by {user?.name ?? "you"}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
