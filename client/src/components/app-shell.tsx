import { LayoutDashboard, ListTodo, LogOut, ShieldCheck, SquarePen } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth-context";
import { getRuntimeHealth } from "../lib/api";
import { cn } from "../lib/utils";
import type { RuntimeStatus } from "../types";
import { Button } from "./ui/button";

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
    isActive ? "bg-amber-200/70 text-slate-950" : "text-slate-200 hover:bg-white/8 hover:text-white",
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
    <div className="grid min-h-screen lg:grid-cols-[300px_1fr]">
      <aside className="flex flex-col justify-between bg-[linear-gradient(180deg,rgba(13,27,42,0.97),rgba(20,33,61,0.98)),linear-gradient(135deg,rgba(249,164,96,0.28),transparent_50%)] p-6 text-white">
        <div className="space-y-8">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-200">Gestor JMU</p>
            <h1 className='font-["IBM_Plex_Serif",Georgia,serif] text-3xl leading-tight'>Painel operacional</h1>
            <p className="text-sm text-slate-300">Fluxo pre-SEI/SEI consolidado num unico lugar.</p>
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
            {hasPermission("admin.user.read") ? (
              <NavLink className={navLinkClassName} to="/admin/users">
                <ShieldCheck className="h-4 w-4" />
                Usuarios
              </NavLink>
            ) : null}
          </nav>
        </div>

        <div className="space-y-4 rounded-[28px] border border-white/10 bg-white/8 p-4">
          <div>
            <p className="font-semibold">{user?.name}</p>
            <p className="text-sm text-slate-300">{user?.email}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-amber-200">{user?.role}</p>
          </div>
          {runtime ? (
            <div className="rounded-[22px] border border-white/10 bg-slate-950/20 px-3 py-3 text-xs text-slate-300">
              <p className="font-bold uppercase tracking-[0.22em] text-amber-200">Runtime</p>
              <p className="mt-2 text-sm font-semibold text-white">
                v{runtime.version}
                {runtime.commitSha ? ` · ${runtime.commitSha.slice(0, 7)}` : ""}
              </p>
              <p className="mt-1">
                {runtime.environment} · no ar ha {formatUptime(runtime.uptimeSeconds)}
              </p>
            </div>
          ) : null}
          <Button className="w-full" onClick={handleLogout} type="button" variant="secondary">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      <main className="p-4 sm:p-6 xl:p-8">
        <Outlet />
      </main>
    </div>
  );
}
