import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth-context";
import { AppShell } from "./components/app-shell";
import { RequireAuth } from "./components/require-auth";
import { RequirePermission } from "./components/require-permission";
import { AdminUsersPage } from "./pages/admin-users-page";
import { DashboardPage } from "./pages/dashboard-page";
import { LoginPage } from "./pages/login-page";
import { NewPreDemandaPage } from "./pages/new-pre-demanda-page";
import { NotFoundPage } from "./pages/not-found-page";
import { PreDemandaDetailPage } from "./pages/pre-demanda-detail-page";
import { PreDemandasPage } from "./pages/pre-demandas-page";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<LoginPage />} path="/login" />

          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route element={<Navigate replace to="/dashboard" />} path="/" />
              <Route element={<DashboardPage />} path="/dashboard" />
              <Route element={<PreDemandasPage />} path="/pre-demandas" />
              <Route element={<NewPreDemandaPage />} path="/pre-demandas/nova" />
              <Route element={<PreDemandaDetailPage />} path="/pre-demandas/:preId" />
              <Route
                element={
                  <RequirePermission permission="admin.user.read">
                    <AdminUsersPage />
                  </RequirePermission>
                }
                path="/admin/users"
              />
            </Route>
          </Route>

          <Route element={<NotFoundPage />} path="*" />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
