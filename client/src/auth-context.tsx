import { createContext, useContext, useEffect, useState } from "react";
import { ApiError, getCurrentUser, login as apiLogin, logout as apiLogout } from "./lib/api";
import type { AuthUser } from "./types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  async function refresh() {
    try {
      const nextUser = await getCurrentUser();
      setUser(nextUser);
      setStatus("authenticated");
    } catch (error) {
      if (error instanceof ApiError && error.code === "UNAUTHENTICATED") {
        setUser(null);
        setStatus("unauthenticated");
        return;
      }

      setUser(null);
      setStatus("unauthenticated");
    }
  }

  async function login(email: string, password: string) {
    const nextUser = await apiLogin(email, password);
    setUser(nextUser);
    setStatus("authenticated");
  }

  async function logout() {
    await apiLogout();
    setUser(null);
    setStatus("unauthenticated");
  }

  useEffect(() => {
    void refresh();
  }, []);

  return <AuthContext.Provider value={{ user, status, login, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
