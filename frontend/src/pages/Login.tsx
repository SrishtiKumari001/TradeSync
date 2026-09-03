import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../api/client";
import { Alert, Button, Input, Label } from "../components/ui";

const demoAccounts = [
  { email: "admin@minierp.com", password: "Admin@123", role: "Admin" },
  { email: "sales@minierp.com", password: "Sales@123", role: "Sales" },
  { email: "warehouse@minierp.com", password: "Warehouse@123", role: "Warehouse" },
  { email: "accounts@minierp.com", password: "Accounts@123", role: "Accounts" },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img src="/logo.svg" alt="Ops Portal logo" className="mx-auto mb-3 h-16 w-16" />
          <h1 className="text-2xl font-bold text-slate-900">Ops Portal</h1>
          <p className="text-sm text-slate-500">Mini ERP + CRM Operations Portal</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white/60 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Demo accounts</p>
          <div className="space-y-1">
            {demoAccounts.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email);
                  setPassword(a.password);
                }}
                className="block w-full rounded px-2 py-1 text-left text-xs text-slate-600 hover:bg-slate-100"
              >
                <span className="font-medium text-slate-800">{a.role}</span> — {a.email} / {a.password}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
