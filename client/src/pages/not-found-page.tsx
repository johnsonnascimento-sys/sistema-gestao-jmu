import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="panel">
      <h2>Página não encontrada</h2>
      <p className="muted">A rota solicitada não existe nesta interface.</p>
      <Link className="button primary" to="/dashboard">
        Voltar ao dashboard
      </Link>
    </div>
  );
}
