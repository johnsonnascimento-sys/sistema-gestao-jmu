import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth-context";
import { LoadingState } from "./states";

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-xl">
          <LoadingState description="Aguarde enquanto validamos a sessao activa." title="Carregando sessao" />
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  return <Outlet />;
}
