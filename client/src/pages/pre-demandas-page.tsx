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

const KANBAN_COLUMNS: Array<{ value: PreDemandaStatus; label: string; description: string }> = [
  { value: "aberta", label: "Abertas", description: "Demandas prontas para triagem." },
  { value: "aguardando_sei", label: "Aguardando SEI", description: "Pendentes de número SEI válido." },
  { value: "associada", label: "Associadas", description: "Processos já vinculados ao SEI." },
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
  const hiddenItems = items.filter((item) => !KANBAN_COLUMNS.some((column) => column.value === item.status)).length;

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
        {hiddenItems > 0 ? (
          <p className="muted">
            {hiddenItems} registro(s) com status fora do quadro principal nesta página. Use os filtros ou a paginação para rever esses itens.
          </p>
        ) : null}

        <div className="kanban-board">
          {KANBAN_COLUMNS.map((column) => {
            const columnItems = items.filter((item) => item.status === column.value);

            return (
              <section className="kanban-column" key={column.value}>
                <header className="kanban-column-header">
                  <div>
                    <h3>{column.label}</h3>
                    <p>{column.description}</p>
                  </div>
                  <span className="kanban-count">{columnItems.length}</span>
                </header>

                <div className="kanban-cards">
                  {columnItems.length ? (
                    columnItems.map((item) => (
                      <Link className="kanban-card" key={item.preId} to={`/pre-demandas/${item.preId}`}>
                        <div className="kanban-card-top">
                          <span className="kanban-card-id">{item.preId}</span>
                          <StatusPill status={item.status} />
                        </div>

                        <div>
                          <p className="kanban-label">Solicitante</p>
                          <strong>{item.solicitante}</strong>
                        </div>

                        <div>
                          <p className="kanban-label">Assunto</p>
                          <p className="kanban-subject">{item.assunto}</p>
                        </div>

                        <div className="kanban-meta">
                          <div>
                            <p className="kanban-label">Data</p>
                            <span>{new Date(item.dataReferencia).toLocaleDateString("pt-BR")}</span>
                          </div>
                          <div>
                            <p className="kanban-label">SEI</p>
                            <span>{item.currentAssociation?.seiNumero ?? "Nao associado"}</span>
                          </div>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="kanban-empty">
                      <p>Nenhuma demanda nesta coluna.</p>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
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
