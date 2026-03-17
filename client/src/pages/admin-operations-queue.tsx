import { Link } from "react-router-dom";
import { MetricCard } from "../components/metric-card";
import { EmptyState } from "../components/states";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import type { AdminOpsSummary } from "../types";
import {
  buildPriorityQueueHref,
  buildSetorQueueHref,
  buildWithoutSetorQueueHref,
  deltaTone,
  formatDelta,
  riskTone,
} from "./admin-operations-utils";

export function AdminOperationsQueueSection({
  report,
}: {
  report: AdminOpsSummary["caseManagementReport"];
}) {
  return (
    <Card id="governanca-casos">
      <CardHeader>
        <CardTitle>Governanca de processos</CardTitle>
        <CardDescription>
          Recorte operacional dos ultimos {report.periodDays} dias, com foco em carga, prazo e distribuicao por setor.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="grid gap-2">
            <MetricCard label="Processos criados" value={report.createdInPeriod} />
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${deltaTone(report.deltas.createdInPeriod)}`}>
              {formatDelta(report.deltas.createdInPeriod)} vs janela anterior
            </p>
          </div>
          <div className="grid gap-2">
            <MetricCard label="Processos encerrados" value={report.closedInPeriod} />
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${deltaTone(report.deltas.closedInPeriod)}`}>
              {formatDelta(report.deltas.closedInPeriod)} vs janela anterior
            </p>
          </div>
          <div className="grid gap-2">
            <MetricCard label="Tramitacoes" value={report.tramitacoesInPeriod} />
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${deltaTone(report.deltas.tramitacoesInPeriod)}`}>
              {formatDelta(report.deltas.tramitacoesInPeriod)} vs janela anterior
            </p>
          </div>
          <div className="grid gap-2">
            <MetricCard label="Vencidos" value={report.overdueTotal} />
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${deltaTone(report.deltas.overdueTotal)}`}>
              {formatDelta(report.deltas.overdueTotal)} vs janela anterior
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <MetricCard label="Vencem em 7 dias" value={report.dueSoonTotal} />
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${deltaTone(report.deltas.dueSoonTotal)}`}>
              {formatDelta(report.deltas.dueSoonTotal)} vs janela anterior
            </p>
          </div>
          <div className="grid gap-2">
            <MetricCard label="Sem setor" value={report.withoutSetorTotal} />
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${deltaTone(report.deltas.withoutSetorTotal)}`}>
              {formatDelta(report.deltas.withoutSetorTotal)} vs janela anterior
            </p>
          </div>
          <div className="grid gap-2">
            <MetricCard label="Sem envolvidos" value={report.withoutInteressadosTotal} />
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${deltaTone(report.deltas.withoutInteressadosTotal)}`}>
              {formatDelta(report.deltas.withoutInteressadosTotal)} vs janela anterior
            </p>
          </div>
        </div>

        {report.prioritySetores.length ? (
          <div className="grid gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Prioridade imediata</p>
              <p className="mt-1 text-sm text-slate-600">
                Setores ordenados por risco operacional, combinando carga, vencidos, proximidade de prazo e agravamento da fila.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {report.prioritySetores.map((item) => (
                <article className="rounded-[22px] border border-slate-200 bg-white px-4 py-4" key={`priority-${item.setorId ?? "sem-setor"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{item.sigla ?? "Sem setor"}</p>
                      <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.nome ?? "Processos ainda sem destinacao formal."}</h3>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${riskTone(item.riskLevel)}`}>
                      {item.riskLevel}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">Score {item.riskScore} - {item.activeTotal} ativos - {item.overdueTotal} vencidos</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link to={buildPriorityQueueHref(item.setorId, item.overdueTotal > 0 ? "overdue" : item.dueSoonTotal > 0 ? "due_soon" : "", item.riskLevel)}>
                        Abrir fila critica
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link to={item.setorId ? buildSetorQueueHref(item.setorId, "") : buildWithoutSetorQueueHref("", "")}>
                        {item.setorId ? "Ver todas do setor" : "Ver todas sem setor"}
                      </Link>
                    </Button>
                    {!item.setorId ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link to={buildWithoutSetorQueueHref("", "false")}>Sem envolvidos</Link>
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {report.bySetor.length ? (
          <div className="grid gap-3">
            {report.bySetor.map((item) => (
              <article className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 px-4 py-4" key={item.setorId ?? "sem-setor"}>
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{item.sigla ?? "Sem setor"}</p>
                    <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.nome ?? "Processos ainda nao encaminhados para um setor."}</h3>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${riskTone(item.riskLevel)}`}>
                      {item.riskLevel} - {item.riskScore}
                    </span>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{item.activeTotal} ativos</p>
                    <p className={`mt-1 text-xs font-semibold uppercase tracking-[0.18em] ${deltaTone(item.activeDelta)}`}>
                      {formatDelta(item.activeDelta)} vs janela anterior
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Activos</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{item.activeTotal}</p>
                    <p className="mt-1 text-xs text-slate-500">Antes: {item.previousActiveTotal}</p>
                  </div>
                  <div className="rounded-[18px] border border-rose-200 bg-rose-50/70 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-rose-700">Vencidos</p>
                    <p className="mt-2 text-lg font-semibold text-rose-950">{item.overdueTotal}</p>
                  </div>
                  <div className="rounded-[18px] border border-amber-200 bg-amber-50/70 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-700">Vencem em 7 dias</p>
                    <p className="mt-2 text-lg font-semibold text-amber-950">{item.dueSoonTotal}</p>
                  </div>
                  <div className="rounded-[18px] border border-sky-200 bg-sky-50/70 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-sky-700">Aguardando SEI</p>
                    <p className="mt-2 text-lg font-semibold text-sky-950">{item.awaitingSeiTotal}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState description="Assim que houver distribuicao de processos, a leitura por setor aparecera aqui." title="Sem dados por setor" />
        )}
      </CardContent>
    </Card>
  );
}
