import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth-context";
import { MetricCard } from "../components/metric-card";
import { PageHeader } from "../components/page-header";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { downloadAdminOpsCaseReportCsv, formatAppError, getAdminOpsSummary, updateQueueHealthConfig } from "../lib/api";
import type { AdminOpsSummary, OperationalEvent, OperationsIncident } from "../types";

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

  return `${Math.floor(hours / 24)}d`;
}

function describeIncident(incident: OperationsIncident) {
  switch (incident.kind) {
    case "auth_failure":
      return "Falha de autenticacao ou autorizacao.";
    case "database_readiness_failure":
      return "Falha na verificacao de prontidao do banco.";
    case "server_error":
      return "Erro interno registado pela aplicacao.";
    default:
      return "Incidente operacional.";
  }
}

function describeOperationalEvent(event: OperationalEvent) {
  switch (event.kind) {
    case "backup":
      return "Backup";
    case "restore":
      return "Restore";
    case "restore_drill":
      return "Drill de restore";
    case "deploy":
      return "Deploy";
    case "rollback":
      return "Rollback";
    case "monitor":
      return "Monitoracao";
    case "bootstrap_audit":
      return "Auditoria de bootstrap";
    default:
      return "Operacao";
  }
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDelta(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
}

function deltaTone(value: number) {
  if (value > 0) {
    return "text-emerald-700";
  }

  if (value < 0) {
    return "text-rose-700";
  }

  return "text-slate-500";
}

function riskTone(level: "normal" | "attention" | "critical") {
  if (level === "critical") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  if (level === "attention") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function freshnessTone(level: "fresh" | "attention" | "critical" | "unknown") {
  if (level === "critical") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  if (level === "attention") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (level === "fresh") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function formatEventMoment(value: string | null) {
  if (!value) {
    return "Nao registado";
  }

  return new Date(value).toLocaleString("pt-BR");
}

function buildSetorQueueHref(setorId: string, dueState: "" | "overdue" | "due_soon") {
  const search = new URLSearchParams({
    view: "table",
    status: "aberta,aguardando_sei,associada",
    setorAtualId: setorId,
    sortBy: "updatedAt",
    sortOrder: "asc",
    page: "1",
  });

  if (dueState) {
    search.set("dueState", dueState);
  }

  return `/pre-demandas?${search.toString()}`;
}

function buildWithoutSetorQueueHref(dueState: "" | "overdue" | "due_soon", hasInteressados: "" | "true" | "false" = "") {
  const search = new URLSearchParams({
    preset: "sem-setor",
    view: "table",
    sortBy: dueState ? "prazoFinal" : "updatedAt",
    sortOrder: dueState === "overdue" ? "asc" : "desc",
    page: "1",
  });

  if (dueState) {
    search.set("dueState", dueState);
  }

  if (hasInteressados) {
    search.set("hasInteressados", hasInteressados);
  }

  return `/pre-demandas?${search.toString()}`;
}

function buildPriorityQueueHref(setorId: string | null, dueState: "" | "overdue" | "due_soon", riskLevel: "normal" | "attention" | "critical") {
  if (!setorId) {
    if (riskLevel === "critical") {
      return buildWithoutSetorQueueHref(dueState, "");
    }

    if (dueState === "overdue") {
      return buildWithoutSetorQueueHref("overdue", "");
    }

    if (dueState === "due_soon") {
      return buildWithoutSetorQueueHref("due_soon", "");
    }

    return buildWithoutSetorQueueHref("", "");
  }

  return buildSetorQueueHref(setorId, dueState);
}

export function AdminOperationsPage() {
  const { hasPermission } = useAuth();
  const [summary, setSummary] = useState<AdminOpsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [periodDays, setPeriodDays] = useState("30");
  const [queueThresholds, setQueueThresholds] = useState({
    attentionDays: "2",
    criticalDays: "5",
  });
  const [savingQueueThresholds, setSavingQueueThresholds] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  async function load() {
    setLoading(true);

    try {
      const nextSummary = await getAdminOpsSummary(12, Number(periodDays));
      setSummary(nextSummary);
      setQueueThresholds({
        attentionDays: String(nextSummary.queueHealthConfig.attentionDays),
        criticalDays: String(nextSummary.queueHealthConfig.criticalDays),
      });
      setError("");
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao carregar operacoes."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [periodDays]);

  if (loading) {
    return <LoadingState description="A consolidar runtime, contadores, migracoes e incidentes recentes." title="Carregando operacoes" />;
  }

  if (error && !summary) {
    return <ErrorState description={error} />;
  }

  if (!summary) {
    return <ErrorState description="Resumo operacional indisponivel." />;
  }

  const attentionItems = useMemo(() => {
    const items: Array<{
      title: string;
      description: string;
      tone: "critical" | "attention";
      href?: string;
      cta?: string;
      score: number;
      trend?: string;
      area: string;
    }> = [];

    if (summary.operationalSummary.backupFreshness === "critical" || summary.operationalSummary.backupFreshness === "attention") {
      items.push({
        title: "Backup fora do ritmo esperado",
        description:
          summary.operationalSummary.backupAgeHours === null
            ? "Nenhum backup confirmado aparece no painel operacional."
            : `O ultimo backup confirmado tem ${summary.operationalSummary.backupAgeHours} h.`,
        tone: summary.operationalSummary.backupFreshness === "critical" ? "critical" : "attention",
        href: "#backups",
        cta: "Ver backups",
        score: summary.operationalSummary.backupFreshness === "critical" ? 120 : 80,
        trend: summary.operationalSummary.backupAgeHours === null ? "Sem backup recente para comparar." : "A idade do backup cresce ate a proxima execucao valida.",
        area: "Backups",
      });
    }

    if ((summary.migrations?.driftedCount ?? 0) > 0 || (summary.migrations?.pendingCount ?? 0) > 0) {
      items.push({
        title: (summary.migrations?.driftedCount ?? 0) > 0 ? "Drift de schema detectado" : "Migracoes pendentes",
        description:
          (summary.migrations?.driftedCount ?? 0) > 0
            ? `${summary.migrations?.driftedCount ?? 0} migration(s) em drift exigem revisao.`
            : `${summary.migrations?.pendingCount ?? 0} migration(s) ainda nao aplicadas.`,
        tone: (summary.migrations?.driftedCount ?? 0) > 0 ? "critical" : "attention",
        href: "#migracoes",
        cta: "Ver migracoes",
        score: (summary.migrations?.driftedCount ?? 0) > 0 ? 110 + (summary.migrations?.driftedCount ?? 0) * 5 : 70 + (summary.migrations?.pendingCount ?? 0) * 3,
        trend:
          (summary.migrations?.driftedCount ?? 0) > 0
            ? "Drift tende a bloquear deploys e exige correcao imediata."
            : "Pendencias ainda nao impedem a operacao, mas acumulam risco de release.",
        area: "Schema",
      });
    }

    if (summary.operationalSummary.failureCount24h > 0) {
      items.push({
        title: "Falhas operacionais nas ultimas 24h",
        description: `${summary.operationalSummary.failureCount24h} falha(s) operacional(is) recente(s) foram registadas fora do processo da aplicacao.`,
        tone: "attention",
        href: "#operacoes-recentes",
        cta: "Ver operacoes",
        score: 50 + summary.operationalSummary.failureCount24h * 4,
        trend: "O volume considera apenas a janela movel das ultimas 24 horas.",
        area: "Operacoes",
      });
    }

    if (summary.incidentSummary.errorTotal > 0) {
      items.push({
        title: "Incidentes de erro activos no processo",
        description: `${summary.incidentSummary.errorTotal} incidente(s) de nivel error foram registados desde o ultimo arranque.`,
        tone: "critical",
        href: "#incidentes-recentes",
        cta: "Ver incidentes",
        score: 90 + summary.incidentSummary.errorTotal * 4,
        trend: "Incidentes persistem ate novo arranque ou estabilizacao do processo.",
        area: "Incidentes",
      });
    }

    if (summary.caseManagementReport.overdueTotal > 0) {
      const delta = summary.caseManagementReport.deltas.overdueTotal;
      items.push({
        title: "Casos vencidos na fila",
        description: `${summary.caseManagementReport.overdueTotal} demanda(s) activa(s) estao com prazo vencido.`,
        tone: "critical",
        href: "/pre-demandas?preset=prazos-vencidos",
        cta: "Abrir vencidos",
        score: 100 + summary.caseManagementReport.overdueTotal * 6 + Math.max(delta, 0) * 2,
        trend: `${formatDelta(delta)} vs janela anterior.`,
        area: "Fila",
      });
    }

    if (summary.caseManagementReport.withoutSetorTotal > 0) {
      const delta = summary.caseManagementReport.deltas.withoutSetorTotal;
      items.push({
        title: "Demandas sem setor",
        description: `${summary.caseManagementReport.withoutSetorTotal} caso(s) activo(s) ainda nao foram tramitados para um setor.`,
        tone: "attention",
        href: "/pre-demandas?preset=sem-setor",
        cta: "Abrir sem setor",
        score: 60 + summary.caseManagementReport.withoutSetorTotal * 5 + Math.max(delta, 0) * 2,
        trend: `${formatDelta(delta)} vs janela anterior.`,
        area: "Fila",
      });
    }

    if (summary.caseManagementReport.withoutInteressadosTotal > 0) {
      const delta = summary.caseManagementReport.deltas.withoutInteressadosTotal;
      items.push({
        title: "Demandas sem envolvidos",
        description: `${summary.caseManagementReport.withoutInteressadosTotal} caso(s) activo(s) ainda nao possuem envolvidos vinculados.`,
        tone: "attention",
        href: "/pre-demandas?preset=sem-envolvidos",
        cta: "Abrir sem envolvidos",
        score: 55 + summary.caseManagementReport.withoutInteressadosTotal * 4 + Math.max(delta, 0) * 2,
        trend: `${formatDelta(delta)} vs janela anterior.`,
        area: "Fila",
      });
    }

    return items
      .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
      .slice(0, 6);
  }, [summary]);

  return (
    <section className="grid gap-6">
      <PageHeader
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <label className="grid gap-1 text-left text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
              Periodo
              <select
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-900 shadow-sm"
                onChange={(event) => setPeriodDays(event.target.value)}
                value={periodDays}
              >
                <option value="7">7 dias</option>
                <option value="30">30 dias</option>
                <option value="90">90 dias</option>
              </select>
            </label>
            <Button onClick={() => void load()} type="button" variant="secondary">
              Atualizar
            </Button>
            <Button
              disabled={exportingCsv}
              onClick={async () => {
                setExportingCsv(true);
                setError("");
                setMessage("");

                try {
                  await downloadAdminOpsCaseReportCsv(Number(periodDays));
                  setMessage("Relatorio CSV gerado com sucesso.");
                } catch (nextError) {
                  setError(formatAppError(nextError, "Falha ao exportar relatorio CSV."));
                } finally {
                  setExportingCsv(false);
                }
              }}
              type="button"
              variant="secondary"
            >
              {exportingCsv ? "Exportando..." : "Exportar CSV"}
            </Button>
          </div>
        }
        description="Monitoramento minimo da aplicacao, com visao do runtime, do schema e dos incidentes desde o ultimo start."
        eyebrow="Operacoes"
        title="Saude e observabilidade"
      />

      {error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div> : null}

      {attentionItems.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Atencao imediata</CardTitle>
            <CardDescription>Itens que exigem accao mais rapida com base na saude da aplicacao, operacao e fila actual.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 xl:grid-cols-3">
            {attentionItems.map((item) => (
              <article
                className={`grid gap-3 rounded-[24px] border px-4 py-4 ${
                  item.tone === "critical" ? "border-rose-200 bg-rose-50/80" : "border-amber-200 bg-amber-50/80"
                }`}
                key={`${item.title}-${item.description}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{item.tone === "critical" ? "Critico" : "Atencao"}</p>
                    <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                      {item.area}
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.title}</h3>
                </div>
                <p className="text-sm text-slate-700">{item.description}</p>
                {item.trend ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.trend}</p>
                ) : null}
                {item.href && item.cta ? (
                  <div>
                    <Button asChild size="sm" variant="secondary">
                      <Link to={item.href}>{item.cta}</Link>
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Requests" value={summary.counters.requestsTotal} />
        <MetricCard label="Sucesso" value={summary.counters.successfulRequestsTotal} />
        <MetricCard label="Erros 4xx" value={summary.counters.clientErrorsTotal} />
        <MetricCard label="Erros 5xx" value={summary.counters.serverErrorsTotal} />
        <MetricCard label="Falhas auth" value={summary.counters.authFailuresTotal} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Login OK" value={summary.counters.loginSuccessTotal} />
        <MetricCard label="Login falhou" value={summary.counters.loginFailuresTotal} />
        <MetricCard label="Ready falhou" value={summary.counters.readyChecksFailedTotal} />
        <MetricCard label="Unhandled" value={summary.counters.unhandledErrorsTotal} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Governanca de casos</CardTitle>
          <CardDescription>Recorte operativo dos ultimos {summary.caseManagementReport.periodDays} dias, com foco em carga, prazo e distribuicao por setor.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="grid gap-2">
              <MetricCard label="Casos criados" value={summary.caseManagementReport.createdInPeriod} />
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${deltaTone(summary.caseManagementReport.deltas.createdInPeriod)}`}>
                {formatDelta(summary.caseManagementReport.deltas.createdInPeriod)} vs janela anterior
              </p>
            </div>
            <div className="grid gap-2">
              <MetricCard label="Casos encerrados" value={summary.caseManagementReport.closedInPeriod} />
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${deltaTone(summary.caseManagementReport.deltas.closedInPeriod)}`}>
                {formatDelta(summary.caseManagementReport.deltas.closedInPeriod)} vs janela anterior
              </p>
            </div>
            <div className="grid gap-2">
              <MetricCard label="Tramitacoes" value={summary.caseManagementReport.tramitacoesInPeriod} />
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${deltaTone(summary.caseManagementReport.deltas.tramitacoesInPeriod)}`}>
                {formatDelta(summary.caseManagementReport.deltas.tramitacoesInPeriod)} vs janela anterior
              </p>
            </div>
            <div className="grid gap-2">
              <MetricCard label="Vencidos" value={summary.caseManagementReport.overdueTotal} />
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${deltaTone(summary.caseManagementReport.deltas.overdueTotal)}`}>
                {formatDelta(summary.caseManagementReport.deltas.overdueTotal)} vs janela anterior
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <MetricCard label="Vencem em 7 dias" value={summary.caseManagementReport.dueSoonTotal} />
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${deltaTone(summary.caseManagementReport.deltas.dueSoonTotal)}`}>
                {formatDelta(summary.caseManagementReport.deltas.dueSoonTotal)} vs janela anterior
              </p>
            </div>
            <div className="grid gap-2">
              <MetricCard label="Sem setor" value={summary.caseManagementReport.withoutSetorTotal} />
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${deltaTone(summary.caseManagementReport.deltas.withoutSetorTotal)}`}>
                {formatDelta(summary.caseManagementReport.deltas.withoutSetorTotal)} vs janela anterior
              </p>
            </div>
            <div className="grid gap-2">
              <MetricCard label="Sem envolvidos" value={summary.caseManagementReport.withoutInteressadosTotal} />
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${deltaTone(summary.caseManagementReport.deltas.withoutInteressadosTotal)}`}>
                {formatDelta(summary.caseManagementReport.deltas.withoutInteressadosTotal)} vs janela anterior
              </p>
            </div>
          </div>

          {summary.caseManagementReport.prioritySetores.length ? (
            <div className="grid gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Prioridade imediata</p>
                <p className="mt-1 text-sm text-slate-600">Setores ordenados por risco operativo, combinando carga, vencidos, proximidade de prazo e agravamento da fila.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {summary.caseManagementReport.prioritySetores.map((item) => (
                  <article className="rounded-[22px] border border-slate-200 bg-white px-4 py-4" key={`priority-${item.setorId ?? "sem-setor"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{item.sigla ?? "Sem setor"}</p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.nome ?? "Demandas ainda sem destinacao formal."}</h3>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${riskTone(item.riskLevel)}`}>
                        {item.riskLevel}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-700">Score {item.riskScore} - {item.activeTotal} activos - {item.overdueTotal} vencidos</p>
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

          {summary.caseManagementReport.bySetor.length ? (
            <div className="grid gap-3">
              {summary.caseManagementReport.bySetor.map((item) => (
                <article className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 px-4 py-4" key={item.setorId ?? "sem-setor"}>
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{item.sigla ?? "Sem setor"}</p>
                      <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.nome ?? "Demandas ainda nao encaminhadas para um setor."}</h3>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${riskTone(item.riskLevel)}`}>
                        {item.riskLevel} - {item.riskScore}
                      </span>
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{item.activeTotal} activos</p>
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
            <EmptyState description="Assim que houver distribuicao de casos, a leitura por setor aparecera aqui." title="Sem dados por setor" />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Runtime actual</CardTitle>
            <CardDescription>Dados do processo actualmente em execucao.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-slate-600">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Versao</p>
              <p className="mt-1 text-slate-950">
                v{summary.runtime.version}
                {summary.runtime.commitSha ? ` - ${summary.runtime.commitSha}` : ""}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Ambiente</p>
              <p className="mt-1 text-slate-950">{summary.runtime.environment}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Uptime</p>
              <p className="mt-1 text-slate-950">{formatUptime(summary.runtime.uptimeSeconds)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Iniciado em</p>
              <p className="mt-1 text-slate-950">{new Date(summary.runtime.startedAt).toLocaleString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Banco</p>
              <p className="mt-1 text-slate-950">
                {summary.runtime.database?.status === "ready"
                  ? `Pronto - ${summary.runtime.database.latencyMs ?? 0} ms`
                  : `Falha - ${summary.runtime.database?.message ?? "Sem detalhe."}`}
              </p>
              {summary.runtime.database?.checkedAt ? (
                <p className="mt-1 text-xs text-slate-500">Verificado em {new Date(summary.runtime.database.checkedAt).toLocaleString("pt-BR")}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Regras da fila</CardTitle>
            <CardDescription>Limiar operativo para sinalizar demandas em atencao ou criticas.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-slate-600">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Atencao</p>
                <p className="mt-1 text-slate-950">{summary.queueHealthConfig.attentionDays} dias sem movimentacao</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Critica</p>
                <p className="mt-1 text-slate-950">{summary.queueHealthConfig.criticalDays} dias sem movimentacao</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Origem</p>
              <p className="mt-1 text-slate-950">{summary.queueHealthConfig.source === "database" ? "Configuracao persistida no banco" : "Fallback do ambiente"}</p>
              {summary.queueHealthConfig.updatedAt ? (
                <p className="mt-1 text-xs text-slate-500">
                  Atualizada em {new Date(summary.queueHealthConfig.updatedAt).toLocaleString("pt-BR")}
                  {summary.queueHealthConfig.updatedBy ? ` por ${summary.queueHealthConfig.updatedBy.name}` : ""}
                </p>
              ) : null}
            </div>

            {hasPermission("admin.ops.update") ? (
              <form
                className="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setSavingQueueThresholds(true);
                  setError("");
                  setMessage("");

                  try {
                    await updateQueueHealthConfig({
                      attentionDays: Number(queueThresholds.attentionDays),
                      criticalDays: Number(queueThresholds.criticalDays),
                    });
                    setMessage("Regras da fila actualizadas com sucesso.");
                    await load();
                  } catch (nextError) {
                    setError(formatAppError(nextError, "Falha ao actualizar regras da fila."));
                  } finally {
                    setSavingQueueThresholds(false);
                  }
                }}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Atencao</span>
                    <Input
                      min="1"
                      onChange={(event) => setQueueThresholds((current) => ({ ...current, attentionDays: event.target.value }))}
                      type="number"
                      value={queueThresholds.attentionDays}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Critica</span>
                    <Input
                      min="1"
                      onChange={(event) => setQueueThresholds((current) => ({ ...current, criticalDays: event.target.value }))}
                      type="number"
                      value={queueThresholds.criticalDays}
                    />
                  </label>
                </div>

                <div className="flex justify-end">
                  <Button disabled={savingQueueThresholds} type="submit" variant="secondary">
                    {savingQueueThresholds ? "Salvando..." : "Salvar regras"}
                  </Button>
                </div>
              </form>
            ) : null}
          </CardContent>
        </Card>

      <Card id="backups">
        <CardHeader>
          <CardTitle>Backups visiveis</CardTitle>
            <CardDescription>Ultimos dumps acessiveis ao container para conferencias e resposta a incidente.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-slate-600">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Diretorio montado</p>
              <p className="mt-1 text-slate-950">{summary.backupStatus.directory}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Schema</p>
              <p className="mt-1 text-slate-950">{summary.backupStatus.schemaName}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Ultimo backup valido</p>
              {summary.backupStatus.lastBackup ? (
                <>
                  <p className="mt-1 text-slate-950">{summary.backupStatus.lastBackup.fileName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(summary.backupStatus.lastBackup.modifiedAt).toLocaleString("pt-BR")} - {formatBytes(summary.backupStatus.lastBackup.sizeBytes)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-slate-950">Nenhum backup visivel</p>
              )}
            </div>
            {summary.backupStatus.message ? <p className="rounded-[20px] border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm text-amber-900">{summary.backupStatus.message}</p> : null}
            {summary.backupStatus.recentBackups.length ? (
              <div className="grid gap-2">
                {summary.backupStatus.recentBackups.map((backup) => (
                  <article className="rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-3" key={backup.fileName}>
                    <p className="text-sm font-semibold text-slate-950">{backup.fileName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(backup.modifiedAt).toLocaleString("pt-BR")} - {formatBytes(backup.sizeBytes)}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState description="Assim que o volume de backup estiver montado e houver dumps validos, eles aparecerao aqui." title="Sem backups visiveis" />
            )}
          </CardContent>
        </Card>

        <Card id="migracoes">
          <CardHeader>
            <CardTitle>Migracoes de schema</CardTitle>
            <CardDescription>Comparacao entre os scripts versionados e o que o banco reporta como aplicado.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-slate-600">
            {summary.migrations ? (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Total</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{summary.migrations.totalFiles}</p>
                  </div>
                  <div className="rounded-[22px] border border-emerald-200 bg-emerald-50/70 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-emerald-700">Aplicadas</p>
                    <p className="mt-2 text-lg font-semibold text-emerald-950">{summary.migrations.appliedCount}</p>
                  </div>
                  <div className="rounded-[22px] border border-amber-200 bg-amber-50/70 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-amber-700">Pendentes</p>
                    <p className="mt-2 text-lg font-semibold text-amber-950">{summary.migrations.pendingCount}</p>
                  </div>
                  <div className="rounded-[22px] border border-rose-200 bg-rose-50/70 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-rose-700">Drift</p>
                    <p className="mt-2 text-lg font-semibold text-rose-950">{summary.migrations.driftedCount}</p>
                  </div>
                </div>

                <div className="grid gap-2">
                  {summary.migrations.items.map((item) => (
                    <article className="flex flex-col gap-2 rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-3 md:flex-row md:items-center md:justify-between" key={item.version}>
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{item.version}</p>
                        <p className="text-xs text-slate-500">
                          {item.appliedAt ? `Aplicada em ${new Date(item.appliedAt).toLocaleString("pt-BR")}` : "Ainda nao aplicada"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                          item.state === "applied"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.state === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {item.state}
                      </span>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState description="O resumo de migracoes volta a aparecer assim que o banco responder normalmente." title="Migracoes indisponiveis" />
            )}
          </CardContent>
        </Card>

        <Card id="postura-operacional">
          <CardHeader>
            <CardTitle>Postura operacional</CardTitle>
            <CardDescription>Leitura rapida do ultimo backup, deploy, drill e monitorizacao para reduzir a necessidade de inspecionar o feed completo.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Freshness do backup</p>
                <p className="mt-1 text-slate-950">
                  {summary.operationalSummary.backupAgeHours === null ? "Sem backup confirmado" : `${summary.operationalSummary.backupAgeHours} h desde o ultimo backup`}
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${freshnessTone(summary.operationalSummary.backupFreshness)}`}>
                {summary.operationalSummary.backupFreshness}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ultimo backup OK</p>
                <p className="mt-2 font-semibold text-slate-950">{formatEventMoment(summary.operationalSummary.lastSuccessfulBackupAt)}</p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ultimo deploy OK</p>
                <p className="mt-2 font-semibold text-slate-950">{formatEventMoment(summary.operationalSummary.lastSuccessfulDeployAt)}</p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ultimo drill OK</p>
                <p className="mt-2 font-semibold text-slate-950">{formatEventMoment(summary.operationalSummary.lastSuccessfulRestoreDrillAt)}</p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ultima auditoria OK</p>
                <p className="mt-2 font-semibold text-slate-950">{formatEventMoment(summary.operationalSummary.lastSuccessfulBootstrapAuditAt)}</p>
              </div>
            </div>
            <div className={`rounded-[20px] border px-4 py-3 ${summary.operationalSummary.lastFailedMonitorAt ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
              <p className="text-xs font-bold uppercase tracking-[0.22em]">Monitorizacao</p>
              <p className="mt-2 font-semibold">
                {summary.operationalSummary.lastFailedMonitorAt
                  ? `Ultima falha em ${formatEventMoment(summary.operationalSummary.lastFailedMonitorAt)}`
                  : "Sem falhas recentes de monitorizacao"}
              </p>
              {summary.operationalSummary.lastFailedMonitorMessage ? <p className="mt-1 text-xs">{summary.operationalSummary.lastFailedMonitorMessage}</p> : null}
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Falhas operacionais 24h</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">{summary.operationalSummary.failureCount24h}</p>
              {summary.operationalSummary.failuresByKind24h.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {summary.operationalSummary.failuresByKind24h.map((item) => (
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700" key={`failure-kind-${item.kind}`}>
                      {describeOperationalEvent({
                        id: item.kind,
                        kind: item.kind,
                        status: "failure",
                        source: "",
                        message: "",
                        reference: null,
                        occurredAt: new Date().toISOString(),
                      })}
                      {" "}
                      {item.total}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Nenhuma falha operacional registada nas ultimas 24 horas.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card id="incidentes-recentes">
        <CardHeader>
          <CardTitle>Incidentes recentes</CardTitle>
          <CardDescription>Eventos registados desde o ultimo arranque do processo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">{summary.incidentSummary.total}</p>
            </div>
            <div className="rounded-[20px] border border-amber-200 bg-amber-50/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-amber-700">Warn</p>
              <p className="mt-2 text-lg font-semibold text-amber-950">{summary.incidentSummary.warnTotal}</p>
            </div>
            <div className="rounded-[20px] border border-rose-200 bg-rose-50/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-rose-700">Error</p>
              <p className="mt-2 text-lg font-semibold text-rose-950">{summary.incidentSummary.errorTotal}</p>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ultimo incidente</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{formatEventMoment(summary.incidentSummary.latestOccurredAt)}</p>
            </div>
          </div>
          {summary.incidentSummary.byKind.length ? (
            <div className="flex flex-wrap gap-2">
              {summary.incidentSummary.byKind.map((item) => (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700" key={`incident-kind-${item.kind}`}>
                  {describeIncident({
                    id: item.kind,
                    kind: item.kind,
                    level: item.kind === "server_error" || item.kind === "database_readiness_failure" ? "error" : "warn",
                    message: "",
                    occurredAt: new Date().toISOString(),
                    requestId: null,
                    userId: null,
                    method: null,
                    path: null,
                    statusCode: null,
                  })}
                  {" "}
                  {item.total}
                </span>
              ))}
            </div>
          ) : null}
          {summary.incidentSummary.topPaths.length ? (
            <div className="grid gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Rotas mais afectadas</p>
              <div className="flex flex-wrap gap-2">
                {summary.incidentSummary.topPaths.map((item) => (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700" key={`incident-path-${item.path}`}>
                    {item.path} {item.total}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {summary.incidents.length === 0 ? (
            <EmptyState description="Quando houver falha de autenticacao, erro interno ou problema de prontidao, os eventos aparecerao aqui." title="Nenhum incidente desde o ultimo start" />
          ) : (
            summary.incidents.map((incident) => (
              <article
                className={`grid gap-2 rounded-[24px] border px-4 py-4 ${
                  incident.level === "error" ? "border-rose-200 bg-rose-50/80" : "border-amber-200 bg-amber-50/80"
                }`}
                key={incident.id}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{incident.kind.replaceAll("_", " ")}</p>
                    <h3 className="mt-1 text-sm font-semibold text-slate-950">{describeIncident(incident)}</h3>
                  </div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{new Date(incident.occurredAt).toLocaleString("pt-BR")}</p>
                </div>
                <p className="text-sm text-slate-700">{incident.message}</p>
                <p className="text-xs text-slate-500">
                  {[incident.method, incident.path, incident.statusCode ? `HTTP ${incident.statusCode}` : null, incident.requestId ? `req ${incident.requestId}` : null]
                    .filter(Boolean)
                    .join(" - ")}
                </p>
              </article>
            ))
          )}
        </CardContent>
      </Card>

      <Card id="operacoes-recentes">
        <CardHeader>
          <CardTitle>Operacoes recentes</CardTitle>
          <CardDescription>Backups, deploys, rollbacks, drills e auditorias executadas fora do processo da aplicacao.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {summary.operationalEvents.length === 0 ? (
            <EmptyState description="Assim que backup, deploy, rollback, monitoracao ou auditoria registar eventos, eles aparecerao aqui." title="Sem operacoes registadas" />
          ) : (
            summary.operationalEvents.map((event) => (
              <article
                className={`grid gap-2 rounded-[24px] border px-4 py-4 ${
                  event.status === "failure" ? "border-rose-200 bg-rose-50/80" : "border-emerald-200 bg-emerald-50/80"
                }`}
                key={event.id}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{describeOperationalEvent(event)}</p>
                    <h3 className="mt-1 text-sm font-semibold text-slate-950">{event.message}</h3>
                  </div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{new Date(event.occurredAt).toLocaleString("pt-BR")}</p>
                </div>
                <p className="text-sm text-slate-700">
                  {event.status === "failure" ? "Falha operacional registada." : "Execucao concluida com sucesso."}
                  {event.reference ? ` Referencia: ${event.reference}` : ""}
                </p>
                <p className="text-xs text-slate-500">Origem: {event.source}</p>
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
