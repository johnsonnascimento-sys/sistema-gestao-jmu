import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth-context";
import { AppShell } from "./components/app-shell";
import { RequireAuth } from "./components/require-auth";
import { RequirePermission } from "./components/require-permission";
import { LoadingState } from "./components/states";

const AdminOperationsPage = lazy(() => import("./pages/admin-operations-page").then((module) => ({ default: module.AdminOperationsPage })));
const AdminAuditPage = lazy(() => import("./pages/admin-audit-page").then((module) => ({ default: module.AdminAuditPage })));
const AdminUsersPage = lazy(() => import("./pages/admin-users-page").then((module) => ({ default: module.AdminUsersPage })));
const AndamentosLotePage = lazy(() => import("./pages/andamentos-lote-page").then((module) => ({ default: module.AndamentosLotePage })));
const DashboardPage = lazy(() => import("./pages/dashboard-page").then((module) => ({ default: module.DashboardPage })));
const PacotesProcessosPage = lazy(() => import("./pages/pacotes-processos-page").then((module) => ({ default: module.PacotesProcessosPage })));
const ProcessosLotePage = lazy(() => import("./pages/processos-lote-page").then((module) => ({ default: module.ProcessosLotePage })));
const TarefasLotePage = lazy(() => import("./pages/tarefas-lote-page").then((module) => ({ default: module.TarefasLotePage })));
const TarefasPage = lazy(() => import("./pages/tarefas-page").then((module) => ({ default: module.TarefasPage })));
const AudienciasPautaPage = lazy(() => import("./pages/audiencias-pauta-page").then((module) => ({ default: module.AudienciasPautaPage })));
const AssuntosPage = lazy(() => import("./pages/assuntos-page").then((module) => ({ default: module.AssuntosPage })));
const InteressadosPage = lazy(() => import("./pages/interessados-page").then((module) => ({ default: module.InteressadosPage })));
const LoginPage = lazy(() => import("./pages/login-page").then((module) => ({ default: module.LoginPage })));
const NewPreDemandaPage = lazy(() => import("./pages/new-pre-demanda-page").then((module) => ({ default: module.NewPreDemandaPage })));
const NotFoundPage = lazy(() => import("./pages/not-found-page").then((module) => ({ default: module.NotFoundPage })));
const NormasPage = lazy(() => import("./pages/normas-page").then((module) => ({ default: module.NormasPage })));
const PreDemandaDetailPage = lazy(() => import("./pages/pre-demanda-detail-page").then((module) => ({ default: module.PreDemandaDetailPage })));
const PreDemandasPage = lazy(() => import("./pages/pre-demandas-page").then((module) => ({ default: module.PreDemandasPage })));
const SetoresPage = lazy(() => import("./pages/setores-page").then((module) => ({ default: module.SetoresPage })));

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingState title="Carregando" description="Abrindo a pagina solicitada." />}>
          <Routes>
            <Route element={<LoginPage />} path="/login" />

            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route element={<Navigate replace to="/dashboard" />} path="/" />
                <Route element={<DashboardPage />} path="/dashboard" />
                <Route element={<TarefasPage />} path="/tarefas" />
                <Route element={<AudienciasPautaPage />} path="/pauta-audiencias" />
                <Route element={<PreDemandasPage />} path="/processos" />
                <Route element={<PreDemandasPage />} path="/pre-demandas" />
                <Route element={<NewPreDemandaPage />} path="/pre-demandas/nova" />
                <Route element={<PreDemandaDetailPage />} path="/pre-demandas/:preId" />
                <Route
                  element={
                    <RequirePermission permission="pre_demanda.update">
                      <AndamentosLotePage />
                    </RequirePermission>
                  }
                  path="/andamentos-lote"
                />
                <Route
                  element={
                    <RequirePermission permission="pre_demanda.create">
                      <ProcessosLotePage />
                    </RequirePermission>
                  }
                  path="/processos-lote"
                />
                <Route
                  element={
                    <RequirePermission permission="pre_demanda.update">
                      <TarefasLotePage />
                    </RequirePermission>
                  }
                  path="/tarefas-lote"
                />
                <Route
                  element={
                    <RequirePermission permission="cadastro.assunto.read">
                      <AssuntosPage />
                    </RequirePermission>
                  }
                  path="/assuntos"
                />
                <Route
                  element={
                    <RequirePermission permission="cadastro.assunto.write">
                      <PacotesProcessosPage />
                    </RequirePermission>
                  }
                  path="/pacotes-processos"
                />
                <Route
                  element={
                    <RequirePermission permission="cadastro.interessado.read">
                      <InteressadosPage />
                    </RequirePermission>
                  }
                  path="/pessoas"
                />
                <Route element={<Navigate replace to="/pessoas" />} path="/interessados" />
                <Route
                  element={
                    <RequirePermission permission="cadastro.norma.read">
                      <NormasPage />
                    </RequirePermission>
                  }
                  path="/normas"
                />
                <Route
                  element={
                    <RequirePermission permission="cadastro.setor.read">
                      <SetoresPage />
                    </RequirePermission>
                  }
                  path="/setores"
                />
                <Route
                  element={
                    <RequirePermission permission="admin.user.read">
                      <AdminUsersPage />
                    </RequirePermission>
                  }
                  path="/admin/users"
                />
                <Route
                  element={
                    <RequirePermission permission="admin.ops.read">
                      <AdminOperationsPage />
                    </RequirePermission>
                  }
                  path="/admin/operacoes"
                />
                <Route
                  element={
                    <RequirePermission permission="admin.audit.read">
                      <AdminAuditPage />
                    </RequirePermission>
                  }
                  path="/admin/auditoria"
                />
              </Route>
            </Route>

            <Route element={<NotFoundPage />} path="*" />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
