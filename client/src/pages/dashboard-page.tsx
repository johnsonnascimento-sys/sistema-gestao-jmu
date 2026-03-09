import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MetricCard } from "../components/metric-card";
import { StatusPill } from "../components/status-pill";
import { listPreDemandas } from "../lib/api";
import type { PreDemanda, StatusCount } from "../types";

export function DashboardPage() {
  const [counts, setCounts] = useState<StatusCount[]>([]);
  const [recentItems, setRecentItems] = useState<PreDemanda[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await listPreDemandas({ page: 1, pageSize: 5 });
        setCounts(response.counts);
        setRecentItems(response.items);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Falha ao carregar dashboard.");
      }
    })();
  }, []);

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Visao geral</p>
          <h2>Dashboard do Gestor</h2>
        </div>

        <Link className="button primary" to="/pre-demandas/nova">
          Nova demanda
        </Link>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="metrics-grid">
        {counts.map((item) => (
          <MetricCard key={item.status} label={item.status.replace("_", " ")} value={item.total} />
        ))}
      </div>

      <section className="panel">
        <div className="section-header">
          <h3>Ultimas demandas atualizadas</h3>
          <Link to="/pre-demandas">Ver lista completa</Link>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PRE</th>
                <th>Solicitante</th>
                <th>Assunto</th>
                <th>Status</th>
                <th>Atualizada</th>
              </tr>
            </thead>
            <tbody>
              {recentItems.map((item) => (
                <tr key={item.preId}>
                  <td>
                    <Link to={`/pre-demandas/${item.preId}`}>{item.preId}</Link>
                  </td>
                  <td>{item.solicitante}</td>
                  <td>{item.assunto}</td>
                  <td>
                    <StatusPill status={item.status} />
                  </td>
                  <td>{new Date(item.updatedAt).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
