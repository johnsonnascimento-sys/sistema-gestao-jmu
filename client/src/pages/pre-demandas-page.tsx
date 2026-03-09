import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MetricCard } from "../components/metric-card";
import { StatusPill } from "../components/status-pill";
import { listPreDemandas } from "../lib/api";
import type { PreDemanda, PreDemandaStatus, StatusCount } from "../types";

const STATUSES: Array<{ value: PreDemandaStatus; label: string }> = [
  { value: "aberta", label: "Aberta" },
  { value: "aguardando_sei", label: "Aguardando SEI" },
  { value: "associada", label: "Associada" },
  { value: "encerrada", label: "Encerrada" },
];

export function PreDemandasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<PreDemanda[]>([]);
  const [counts, setCounts] = useState<StatusCount[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(searchParams.get("status")?.split(",").filter(Boolean) ?? []);
  const [error, setError] = useState("");

  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = 10;

  useEffect(() => {
    void (async () => {
      try {
        const response = await listPreDemandas({
          q: searchParams.get("q") ?? "",
          status: searchParams.get("status")?.split(",").filter(Boolean) ?? [],
          page,
          pageSize,
        });

        setItems(response.items);
        setCounts(response.counts);
        setTotal(response.total);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Falha ao carregar pendencias.");
      }
    })();
  }, [page, pageSize, searchParams]);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();

    if (query.trim()) {
      next.set("q", query.trim());
    }

    if (selectedStatuses.length) {
      next.set("status", selectedStatuses.join(","));
    }

    next.set("page", "1");
    setSearchParams(next);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Fila operacional</p>
          <h2>Pendencias do Gestor</h2>
        </div>
      </header>

      <section className="panel">
        <form className="filters" onSubmit={handleFilterSubmit}>
          <label>
            Buscar
            <input onChange={(event) => setQuery(event.target.value)} placeholder="PRE, solicitante ou assunto" value={query} />
          </label>

          <label>
            Status
            <select
              multiple
              onChange={(event) => setSelectedStatuses(Array.from(event.target.selectedOptions, (option) => option.value))}
              value={selectedStatuses}
            >
              {STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>

          <button className="button primary" type="submit">
            Filtrar
          </button>
        </form>
      </section>

      <div className="metrics-grid">
        {counts.map((item) => (
          <MetricCard key={item.status} label={item.status.replace("_", " ")} value={item.total} />
        ))}
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PRE</th>
                <th>Solicitante</th>
                <th>Assunto</th>
                <th>Status</th>
                <th>SEI</th>
                <th>Atualizada</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.preId}>
                  <td>
                    <Link to={`/pre-demandas/${item.preId}`}>{item.preId}</Link>
                  </td>
                  <td>{item.solicitante}</td>
                  <td>{item.assunto}</td>
                  <td>
                    <StatusPill status={item.status} />
                  </td>
                  <td>{item.currentAssociation?.seiNumero ?? "-"}</td>
                  <td>{new Date(item.updatedAt).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <button className="button ghost" disabled={page <= 1} onClick={() => setSearchParams(new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(page - 1) }))} type="button">
            Anterior
          </button>
          <span>
            Pagina {page} de {totalPages}
          </span>
          <button
            className="button ghost"
            disabled={page >= totalPages}
            onClick={() => setSearchParams(new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(page + 1) }))}
            type="button"
          >
            Proxima
          </button>
        </div>
      </section>
    </section>
  );
}
