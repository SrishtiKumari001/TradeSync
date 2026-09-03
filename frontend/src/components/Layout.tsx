import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { RoleBadge } from "./ui";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/customers", label: "Customers" },
  { to: "/products", label: "Products" },
  { to: "/challans", label: "Challans" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 w-56 bg-slate-900 text-slate-300">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 px-5 py-5">
            <img src="/logo.svg" alt="Ops Portal logo" className="h-9 w-9 shrink-0" />
            <div>
              <h1 className="text-lg font-bold leading-tight text-white">Ops Portal</h1>
              <p className="text-xs text-slate-400">Mini ERP + CRM</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm font-medium transition ${
                    isActive ? "bg-indigo-600 text-white" : "hover:bg-slate-800 hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          {user && (
            <div className="border-t border-slate-800 p-4">
              <p className="text-sm font-medium text-white">{user.name}</p>
              <p className="mb-2 text-xs text-slate-400">{user.email}</p>
              <RoleBadge role={user.role} />
            </div>
          )}
        </div>
      </aside>
      <main className="ml-56 min-h-screen p-8">
        <div className="flex items-center justify-end pb-4">
          <button onClick={handleLogout} className="text-sm font-medium text-slate-500 hover:text-red-600">
            Sign out
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
