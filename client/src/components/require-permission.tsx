import { Navigate } from "react-router-dom";
import { useAuth } from "../auth-context";
import type { AppPermission } from "../types";

export function RequirePermission({ permission, children }: { permission: AppPermission; children: React.ReactNode }) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return <Navigate replace to="/dashboard" />;
  }

  return <>{children}</>;
}
