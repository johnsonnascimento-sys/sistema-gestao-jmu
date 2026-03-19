import { Link } from "react-router-dom";
import { QueueHealthPill } from "../components/queue-health-pill";
import { EmptyState } from "../components/states";
import { StatusPill } from "../components/status-pill";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { getPreferredReopenStatus } from "../lib/pre-demanda-status";
import { getQueueHealth } from "../lib/queue-health";
import type { PreDemanda } from "../types";
import { formatDateOnlyPtBr } from "../lib/date";

export interface PreDemandasTableProps {
  items: PreDemanda[];
  sectorRiskById: Record<string, "normal" | "attention" | "critical">;
  onQuickAction: (item: PreDemanda, action: "aguardando" | "encerrar" | "reabrir") => void;
}

export function PreDemandasTable({ items, sectorRiskById, onQuickAction }: PreDemandasTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tabela analitica</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {items.length === 0 ? (
          <EmptyState description="Ajuste os filtros ou mude para outro preset para encontrar processos nesta fila." title="Nenhum processo encontrado" />
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="px-3 py-3">Principal</th>
                <th className="px-3 py-3">Pessoa(s)</th>
                <th className="px-3 py-3">Assunto</th>
                <th className="px-3 py-3">Setor</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Fila</th>
                <th className="px-3 py-3">Prazo do processo</th>
                <th className="px-3 py-3">Proxima tarefa</th>
                <th className="px-3 py-3">Prazo</th>
                <th className="px-3 py-3">SEI</th>
                <th className="px-3 py-3">Data</th>
                <th className="px-3 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  className={`border-t ${
                    item.setorAtual?.id && sectorRiskById[item.setorAtual.id] === "critical"
                      ? "border-rose-200 bg-rose-50/40"
                      : item.setorAtual?.id && sectorRiskById[item.setorAtual.id] === "attention"
                        ? "border-amber-200 bg-amber-50/40"
                        : "border-slate-200"
                  }`}
                  key={item.preId}
                >
                  <td className="px-3 py-4 font-semibold text-slate-950">
                    <Link to={`/pre-demandas/${item.preId}`}>{item.principalNumero}</Link>
                    <div className="text-xs font-medium text-slate-500">{item.preId}</div>
                    {item.metadata.urgente ? <div className="mt-2 inline-flex rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">Urgente</div> : null}
                  </td>
                  <td className="px-3 py-4">
                    {item.interessados && item.interessados.length > 0 
                      ? item.interessados.map(i => i.interessado.nome).join(", ") 
                      : item.pessoaPrincipal?.nome ?? "-"}
                  </td>
                  <td className="px-3 py-4">{item.assunto}</td>
                  <td className="px-3 py-4">
                    <div className="grid gap-1">
                      <span>{item.setorAtual ? item.setorAtual.sigla : "-"}</span>
                      {item.setorAtual?.id && sectorRiskById[item.setorAtual.id] !== "normal" ? (
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {sectorRiskById[item.setorAtual.id] === "critical" ? "Setor em risco" : "Setor em observacao"}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap gap-2">
                      <StatusPill status={item.status} />
                      {item.metadata.urgente ? <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-700 ring-1 ring-rose-200">Urgente</span> : null}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="grid gap-2">
                      <QueueHealthPill item={item} />
                      <span className="text-xs text-slate-500">{getQueueHealth(item).detail}</span>
                    </div>
                  </td>
                  <td className="px-3 py-4">{item.status === "encerrada" ? "-" : formatDateOnlyPtBr(item.prazoProcesso)}</td>
                  <td className="px-3 py-4">{item.status === "encerrada" ? "-" : formatDateOnlyPtBr(item.proximoPrazoTarefa, "Sem tarefas")}</td>
                  <td className="px-3 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                        item.status === "encerrada"
                          ? "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                          : item.prazoStatus === "atrasado"
                            ? "bg-rose-100 text-rose-700 ring-1 ring-rose-200"
                            : "bg-sky-100 text-sky-700 ring-1 ring-sky-200"
                      }`}
                    >
                      {item.status === "encerrada" ? "-" : item.prazoStatus === "atrasado" ? "Atrasado" : "No prazo"}
                    </span>
                  </td>
                  <td className="px-3 py-4">{item.currentAssociation?.seiNumero ?? "-"}</td>
                  <td className="px-3 py-4">{formatDateOnlyPtBr(item.dataReferencia)}</td>
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <Link to={`/pre-demandas/${item.preId}`}>Detalhe</Link>
                      </Button>
                      {item.allowedNextStatuses.includes("aguardando_sei") ? (
                        <Button
                          onClick={() => onQuickAction(item, "aguardando")}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Aguardar SEI
                        </Button>
                      ) : null}
                      {item.allowedNextStatuses.includes("encerrada") ? (
                        <Button onClick={() => onQuickAction(item, "encerrar")} size="sm" type="button" variant="ghost">
                          Encerrar
                        </Button>
                      ) : item.status === "encerrada" && getPreferredReopenStatus(item) ? (
                        <Button
                          onClick={() => onQuickAction(item, "reabrir")}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Reabrir
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
