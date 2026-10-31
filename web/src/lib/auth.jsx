import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setSession(await api("/auth/me"));
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (credentials) => setSession(await api("/auth/login", { method: "POST", body: credentials }));
  const register = async (input) => setSession(await api("/auth/register", { method: "POST", body: input }));
  const logout = async () => {
    await api("/auth/logout", { method: "POST", body: {} });
    await refresh();
  };

  const value = {
    loading,
    session,
    user: session?.user ?? null,
    isAdmin: session?.user?.role === "admin",
    // Plans/quotas switched on by the admin. Off = free mode with a per-IP rate limit only.
    pricing: Boolean(session?.pricingEnabled),
    refresh,
    login,
    register,
    logout,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
