import { Activity, BookText, Boxes, Building2, CalendarClock, FileText, History, LayoutDashboard, ListTodo, LogOut, PackagePlus, ShieldCheck, SquarePen, Tag, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth-context";
import { getRuntimeHealth } from "../lib/api";
import { cn } from "../lib/utils";
import { useEvents } from "../hooks/use-events";
import type { RuntimeStatus } from "../types";
import { Button } from "./ui/button";
import { QuickProcessSearch } from "./quick-process-search";
import { SpotlightSearch } from "./spotlight-search";

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
    isActive
      ? "bg-white/14 text-white shadow-[0_12px_30px_rgba(15,23,42,0.22)] ring-1 ring-white/14"
      : "text-slate-200/90 hover:bg-white/8 hover:text-white",
  );

export function AppShell() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);

  useEvents();

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const nextRuntime = await getRuntimeHealth();

        if (mounted) {
          setRuntime(nextRuntime);
        }
      } catch {
        if (mounted) {
          setRuntime(null);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  function formatUptime(totalSeconds: number) {
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }

    const minutes = Math.floor(totalSeconds / 60);

    if (minutes < 60) {
      return `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours}h`;
    }

    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  function formatCommitTimestamp(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[320px_1fr]">
      <aside className="relative overflow-hidden border-b border-white/5 bg-[linear-gradient(160deg,#1e1b4b_0%,#312e81_48%,#0f172a_100%)] px-5 py-5 text-white lg:min-h-screen lg:border-b-0 lg:border-r lg:border-white/5 lg:px-6 lg:py-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent_28%),linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:auto,48px_48px,48px_48px] opacity-90" />
        <div className="relative flex h-full flex-col gap-6">
          <div className="space-y-6">
            <div className="rounded-[24px] border border-white/8 bg-white/6 px-4 py-3 backdrop-blur-xl shadow-lg shadow-indigo-950/15">
              <p className="text-sm font-bold uppercase tracking-[0.32em] text-indigo-100">Gestor JMU</p>
            </div>

            <QuickProcessSearch variant="sidebar" />

            <nav className="grid gap-2">
              <NavLink className={navLinkClassName} to="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </NavLink>
              <NavLink className={navLinkClassName} to="/tarefas">
                <ListTodo className="h-4 w-4" />
                Tarefas
              </NavLink>
              <NavLink className={navLinkClassName} to="/pauta-audiencias">
                <CalendarClock className="h-4 w-4" />
                Pauta de audiências
              </NavLink>
              <NavLink className={navLinkClassName} to="/pre-demandas">
                <ListTodo className="h-4 w-4" />
                Processos
              </NavLink>
              {hasPermission("pre_demanda.update") ? (
                <NavLink className={navLinkClassName} to="/andamentos-lote">
                  <FileText className="h-4 w-4" />
                  Andamentos em Lote
                </NavLink>
              ) : null}
              {hasPermission("pre_demanda.create") ? (
                <NavLink className={navLinkClassName} to="/processos-lote">
                  <Boxes className="h-4 w-4" />
                  Processos em Lote
                </NavLink>
              ) : null}
              {hasPermission("pre_demanda.update") ? (
                <NavLink className={navLinkClassName} to="/tarefas-lote">
                  <ListTodo className="h-4 w-4" />
                  Tarefas em Lote
                </NavLink>
              ) : null}
              <NavLink className={navLinkClassName} to="/pre-demandas/nova">
                <SquarePen className="h-4 w-4" />
                Novo processo
              </NavLink>
              {hasPermission("cadastro.interessado.read") ? (
                <NavLink className={navLinkClassName} to="/pessoas">
                  <Users className="h-4 w-4" />
                  Pessoas
                </NavLink>
              ) : null}
              {hasPermission("cadastro.setor.read") ? (
                <NavLink className={navLinkClassName} to="/setores">
                  <Building2 className="h-4 w-4" />
                  Setores
                </NavLink>
              ) : null}
              {hasPermission("cadastro.norma.read") ? (
                <NavLink className={navLinkClassName} to="/normas">
                  <BookText className="h-4 w-4" />
                  Normas
                </NavLink>
              ) : null}
              {hasPermission("cadastro.assunto.read") ? (
                <NavLink className={navLinkClassName} to="/assuntos">
                  <Tag className="h-4 w-4" />
                  Assuntos
                </NavLink>
              ) : null}
              {hasPermission("cadastro.assunto.write") ? (
                <NavLink className={navLinkClassName} to="/pacotes-processos">
                  <PackagePlus className="h-4 w-4" />
                  Pacotes de Processos
                </NavLink>
              ) : null}
              {hasPermission("admin.user.read") ? (
                <NavLink className={navLinkClassName} to="/admin/users">
                  <ShieldCheck className="h-4 w-4" />
                  Usuarios
                </NavLink>
              ) : null}
              {hasPermission("admin.ops.read") ? (
                <NavLink className={navLinkClassName} to="/admin/operacoes">
                  <Activity className="h-4 w-4" />
                  Operacoes
                </NavLink>
              ) : null}
              {hasPermission("admin.audit.read") ? (
                <NavLink className={navLinkClassName} to="/admin/auditoria">
                  <History className="h-4 w-4" />
                  Auditoria
                </NavLink>
              ) : null}
            </nav>
          </div>

          <div className="mt-auto rounded-[24px] border border-white/10 bg-white/7 p-4 backdrop-blur-xl">
            <div className="mb-3">
              <p className="font-semibold text-white">{user?.name}</p>
              <p className="text-sm text-slate-300">{user?.role}</p>
              {runtime ? (
                <p className="mt-1 text-xs text-indigo-100/75">
                  v{runtime.version}
                  {runtime.commitSha ? ` · ${runtime.commitSha.slice(0, 7)}` : ""}
                  {formatCommitTimestamp(runtime.commitAt) ? ` · ${formatCommitTimestamp(runtime.commitAt)}` : ""}
                </p>
              ) : null}
            </div>
            <Button className="w-full bg-white text-slate-950 hover:bg-slate-50" onClick={handleLogout} type="button" variant="secondary">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      <main className="relative min-w-0 px-4 py-4 sm:px-6 sm:py-6 xl:px-10 xl:py-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 rounded-b-[60px] bg-[radial-gradient(circle_at_top_left,rgba(153,51,65,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(244,181,98,0.18),transparent_28%)]" />
        <Outlet />
        <SpotlightSearch />
      </main>
    </div>
  );
}
