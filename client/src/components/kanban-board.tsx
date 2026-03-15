import { Link } from "react-router-dom";
import type { PreDemanda, PreDemandaStatus } from "../types";
import { getQueueHealth } from "../lib/queue-health";
import { QueueHealthPill } from "./queue-health-pill";
import { StatusPill } from "./status-pill";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

const COLUMNS: Array<{ value: PreDemandaStatus; label: string; description: string }> = [
  { value: "em_andamento", label: "Em andamento", description: "Processos em curso, com ou sem associacao processual concluida." },
  { value: "aguardando_sei", label: "Aguardando SEI", description: "Pendencias aguardando vinculacao valida." },
];

export function KanbanBoard({
  items,
  sectorRiskById,
  selectedSetorId,
  onQuickAction,
}: {
  items: PreDemanda[];
  sectorRiskById?: Record<string, "normal" | "attention" | "critical">;
  selectedSetorId?: string;
  onQuickAction?: (item: PreDemanda, action: "aguardando" | "encerrar" | "reabrir") => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {COLUMNS.map((column) => {
        const columnItems = items.filter((item) => item.status === column.value);

        return (
          <section
            className="panel-noise grid gap-4 rounded-[32px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,248,251,0.88))] p-5 shadow-[0_26px_70px_rgba(20,33,61,0.08)] backdrop-blur-xl"
            key={column.value}
          >
            <header className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-slate-950">{column.label}</h3>
                <p className="text-sm text-slate-500">{column.description}</p>
              </div>
              <Badge variant="outline">{columnItems.length}</Badge>
            </header>

            <div className="grid gap-3">
              {columnItems.length ? (
                columnItems.map((item) => (
                  <article
                    className={`grid gap-4 rounded-[28px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(247,241,233,0.76))] p-5 shadow-[0_14px_34px_rgba(20,33,61,0.08)] ${
                      item.setorAtual?.id && sectorRiskById?.[item.setorAtual.id] === "critical"
                        ? "border-rose-200 bg-[linear-gradient(180deg,rgba(255,241,242,0.98),rgba(255,247,247,0.88))]"
                        : item.setorAtual?.id && sectorRiskById?.[item.setorAtual.id] === "attention"
                          ? "border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,247,237,0.88))]"
                          : "border-white/80"
                    } ${selectedSetorId && item.setorAtual?.id === selectedSetorId ? "ring-2 ring-sky-300/70" : ""}`}
                    key={item.preId}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-rose-600">{item.principalNumero}</p>
                        <h4 className="mt-2 text-base font-semibold text-slate-950">{item.assunto}</h4>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <StatusPill status={item.status} />
                        <QueueHealthPill item={item} />
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm text-slate-600">
                      <p>
                        <span className="font-medium text-slate-950">Pessoa:</span> {item.pessoaPrincipal?.nome ?? item.solicitante}
                      </p>
                      <p>
                        <span className="font-medium text-slate-950">Setor:</span> {item.setorAtual ? item.setorAtual.sigla : "Nao tramitado"}
                      </p>
                      {item.setorAtual?.id && sectorRiskById?.[item.setorAtual.id] ? (
                        <p>
                          <span className="font-medium text-slate-950">Risco do setor:</span>{" "}
                          {sectorRiskById[item.setorAtual.id] === "critical"
                            ? "Critico"
                            : sectorRiskById[item.setorAtual.id] === "attention"
                              ? "Atencao"
                              : "Controlado"}
                        </p>
                      ) : null}
                      <p>
                        <span className="font-medium text-slate-950">Data:</span> {new Date(item.dataReferencia).toLocaleDateString("pt-BR")}
                      </p>
                      <p>
                        <span className="font-medium text-slate-950">Prazo:</span> {item.prazoFinal ? new Date(item.prazoFinal).toLocaleDateString("pt-BR") : "Nao definido"}
                      </p>
                      <p>
                        <span className="font-medium text-slate-950">Envolvidos:</span> {item.interessados.length}
                      </p>
                      <p>
                        <span className="font-medium text-slate-950">Referencia interna:</span> {item.preId}
                      </p>
                      <p>
                        <span className="font-medium text-slate-950">Fila:</span> {getQueueHealth(item).detail}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <Link to={`/pre-demandas/${item.preId}`}>Abrir detalhe</Link>
                      </Button>
                      {onQuickAction && item.allowedNextStatuses.includes("aguardando_sei") ? (
                        <Button onClick={() => onQuickAction(item, "aguardando")} size="sm" type="button" variant="ghost">
                          Aguardar SEI
                        </Button>
                      ) : null}
                      {onQuickAction && item.allowedNextStatuses.includes("encerrada") ? (
                        <Button onClick={() => onQuickAction(item, "encerrar")} size="sm" type="button" variant="ghost">
                          Encerrar
                        </Button>
                      ) : null}
                      {onQuickAction && item.status === "encerrada" && item.allowedNextStatuses.length > 0 ? (
                        <Button onClick={() => onQuickAction(item, "reabrir")} size="sm" type="button" variant="ghost">
                          Reabrir
                        </Button>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[28px] border border-dashed border-slate-300/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.8),rgba(247,241,233,0.72))] px-4 py-10 text-center text-sm text-slate-500">
                  Nenhum processo nesta coluna.
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
