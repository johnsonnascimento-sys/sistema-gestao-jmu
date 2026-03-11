import { Activity, Building2, LayoutDashboard, ListTodo, LogOut, ShieldCheck, SquarePen, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth-context";
import { getRuntimeHealth } from "../lib/api";
import { cn } from "../lib/utils";
import type { RuntimeStatus } from "../types";
import { Button } from "./ui/button";

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

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[320px_1fr]">
      <aside className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(160deg,#0f2b46_0%,#173858_48%,#0f2a44_100%)] px-5 py-5 text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:border-white/10 lg:px-6 lg:py-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,191,105,0.22),transparent_28%),linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:auto,48px_48px,48px_48px] opacity-80" />
        <div className="relative flex h-full flex-col justify-between gap-8">
          <div className="space-y-8">
            <div className="rounded-[30px] border border-white/10 bg-white/7 p-5 backdrop-blur-xl">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-200">Gestor JMU</p>
              <h1 className='mt-3 font-["IBM_Plex_Serif",Georgia,serif] text-3xl leading-tight'>
                Centro de casos
                <span className="block text-slate-200">e tramitacao</span>
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-200/85">
                Operacao inspirada numa linguagem institucional clara, com fluxo, auditoria e governanca num unico painel.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100">Pre-SEI</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-100">Case management</span>
              </div>
            </div>

            <nav className="grid gap-2">
            <NavLink className={navLinkClassName} to="/dashboard">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </NavLink>
            <NavLink className={navLinkClassName} to="/pre-demandas">
              <ListTodo className="h-4 w-4" />
              Pre-demandas
            </NavLink>
            <NavLink className={navLinkClassName} to="/pre-demandas/nova">
              <SquarePen className="h-4 w-4" />
              Nova demanda
            </NavLink>
            {hasPermission("cadastro.interessado.read") ? (
              <NavLink className={navLinkClassName} to="/interessados">
                <Users className="h-4 w-4" />
                Interessados
              </NavLink>
            ) : null}
            {hasPermission("cadastro.setor.read") ? (
              <NavLink className={navLinkClassName} to="/setores">
                <Building2 className="h-4 w-4" />
                Setores
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
            </nav>
          </div>

          <div className="space-y-4 rounded-[30px] border border-white/12 bg-white/7 p-4 backdrop-blur-xl">
            <div>
              <p className="font-semibold">{user?.name}</p>
              <p className="text-sm text-slate-300">{user?.email}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-amber-200">{user?.role}</p>
            </div>
            {runtime ? (
              <div className="rounded-[24px] border border-white/10 bg-slate-950/20 px-4 py-4 text-xs text-slate-300">
                <p className="font-bold uppercase tracking-[0.22em] text-amber-200">Runtime</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  v{runtime.version}
                  {runtime.commitSha ? ` - ${runtime.commitSha.slice(0, 7)}` : ""}
                </p>
                <p className="mt-1">
                  {runtime.environment} - no ar ha {formatUptime(runtime.uptimeSeconds)}
                </p>
              </div>
            ) : null}
            <Button className="w-full bg-white text-slate-950 hover:bg-slate-50" onClick={handleLogout} type="button" variant="secondary">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      <main className="relative min-w-0 px-4 py-4 sm:px-6 sm:py-6 xl:px-10 xl:py-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 rounded-b-[60px] bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,191,105,0.24),transparent_28%)]" />
        <Outlet />
      </main>
    </div>
  );
}
