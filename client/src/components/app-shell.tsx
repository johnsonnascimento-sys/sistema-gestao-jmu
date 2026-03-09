import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth-context";

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Gestor JMU</p>
          <h1>Painel operacional</h1>
        </div>

        <nav className="nav">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/pre-demandas">Pendencias</NavLink>
          <NavLink to="/pre-demandas/nova">Nova demanda</NavLink>
        </nav>

        <div className="sidebar-footer">
          <p>{user?.name}</p>
          <span>{user?.role}</span>
          <button className="button ghost" onClick={handleLogout} type="button">
            Sair
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
