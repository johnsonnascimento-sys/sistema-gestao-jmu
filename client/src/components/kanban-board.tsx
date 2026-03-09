import { Link } from "react-router-dom";
import type { PreDemanda, PreDemandaStatus } from "../types";
import { StatusPill } from "./status-pill";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

const COLUMNS: Array<{ value: PreDemandaStatus; label: string; description: string }> = [
  { value: "aberta", label: "Abertas", description: "Demandas prontas para triagem." },
  { value: "aguardando_sei", label: "Aguardando SEI", description: "Pendencias aguardando vinculacao valida." },
  { value: "associada", label: "Associadas", description: "Processos ja relacionados ao SEI." },
];

export function KanbanBoard({
  items,
  onQuickAction,
}: {
  items: PreDemanda[];
  onQuickAction?: (item: PreDemanda, action: "aguardando" | "encerrar" | "reabrir") => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {COLUMNS.map((column) => {
        const columnItems = items.filter((item) => item.status === column.value);

        return (
          <section className="grid gap-4 rounded-[28px] border border-slate-200/80 bg-white/75 p-4 shadow-[0_24px_60px_rgba(20,33,61,0.08)] backdrop-blur" key={column.value}>
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
                  <article className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm" key={item.preId}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-rose-600">{item.preId}</p>
                        <h4 className="mt-2 text-base font-semibold text-slate-950">{item.assunto}</h4>
                      </div>
                      <StatusPill status={item.status} />
                    </div>

                    <div className="grid gap-2 text-sm text-slate-600">
                      <p>
                        <span className="font-medium text-slate-950">Solicitante:</span> {item.solicitante}
                      </p>
                      <p>
                        <span className="font-medium text-slate-950">Data:</span> {new Date(item.dataReferencia).toLocaleDateString("pt-BR")}
                      </p>
                      <p>
                        <span className="font-medium text-slate-950">SEI:</span> {item.currentAssociation?.seiNumero ?? "Nao associado"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <Link to={`/pre-demandas/${item.preId}`}>Abrir detalhe</Link>
                      </Button>
                      {onQuickAction && item.status === "aberta" ? (
                        <Button onClick={() => onQuickAction(item, "aguardando")} size="sm" type="button" variant="ghost">
                          Aguardar SEI
                        </Button>
                      ) : null}
                      {onQuickAction && item.status !== "encerrada" ? (
                        <Button onClick={() => onQuickAction(item, "encerrar")} size="sm" type="button" variant="ghost">
                          Encerrar
                        </Button>
                      ) : null}
                      {onQuickAction && item.status === "encerrada" ? (
                        <Button onClick={() => onQuickAction(item, "reabrir")} size="sm" type="button" variant="ghost">
                          Reabrir
                        </Button>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/70 px-4 py-10 text-center text-sm text-slate-500">
                  Nenhuma demanda nesta coluna.
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
