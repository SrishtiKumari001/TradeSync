import { createContext, useContext, useState, ReactNode } from "react";
import type { User } from "../types";
import { authApi } from "../api/endpoints";

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem("minierp_user");
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  });

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    localStorage.setItem("minierp_token", res.token);
    localStorage.setItem("minierp_user", JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem("minierp_token");
    localStorage.removeItem("minierp_user");
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export const SALES_ROLES = ["SALES", "ADMIN"] as const;
export const WAREHOUSE_ROLES = ["WAREHOUSE", "ADMIN"] as const;
