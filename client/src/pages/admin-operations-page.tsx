import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth-context";
import { MetricCard } from "../components/metric-card";
import { PageHeader } from "../components/page-header";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { downloadAdminOpsCaseReportCsv, formatAppError, getAdminOpsSummary, updateQueueHealthConfig } from "../lib/api";
import type { AdminOpsSummary, OperationalEvent, OperationsIncident } from "../types";
import {
  formatUptime,
  describeIncident,
  describeOperationalEvent,
  describeOperationalEventKind,
  formatBytes,
  formatDelta,
  deltaTone,
  riskTone,
  freshnessTone,
  sectionCardClass,
  formatEventMoment,
  buildSetorQueueHref,
  buildWithoutSetorQueueHref,
  buildPriorityQueueHref,
} from "./admin-operations-utils";
import { AdminOperationsQueueSection } from "./admin-operations-queue";
import {
  AdminOperationsBackupSection,
  AdminOperationsEventsSection,
  AdminOperationsIncidentsSection,
  AdminOperationsPostureSection,
  AdminOperationsRuntimeSection,
  AdminOperationsSchemaSection,
} from "./admin-operations-sections";

export function AdminOperationsPage() {
  const { hasPermission } = useAuth();
  const location = useLocation();
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
        description: `${summary.operationalSummary.failureCount24h} falha(s) operacional(is) recente(s) foram registradas fora do processo da aplicacao.`,
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
        title: "Incidentes de erro ativos no processo",
        description: `${summary.incidentSummary.errorTotal} incidente(s) de nivel error foram registrados desde o ultimo arranque.`,
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
        title: "Processos vencidos na fila",
        description: `${summary.caseManagementReport.overdueTotal} processo(s) ativo(s) estao com prazo vencido.`,
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
        title: "Processos sem setor",
        description: `${summary.caseManagementReport.withoutSetorTotal} processo(s) ativo(s) ainda nao foram tramitados para um setor.`,
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
        title: "Processos sem envolvidos",
        description: `${summary.caseManagementReport.withoutInteressadosTotal} processo(s) ativo(s) ainda nao possuem envolvidos vinculados.`,
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
  const quickSectionLinks = useMemo(
    () => [
      {
        id: "backups",
        title: "Backups",
        description:
          summary.operationalSummary.backupAgeHours === null
            ? "Sem backup confirmado no painel."
            : `${summary.operationalSummary.backupAgeHours} h desde o ultimo backup valido.`,
        badge: summary.operationalSummary.backupFreshness,
      },
      {
        id: "migracoes",
        title: "Schema",
        description:
          (summary.migrations?.driftedCount ?? 0) > 0
            ? `${summary.migrations?.driftedCount ?? 0} drift(s) detectados.`
            : `${summary.migrations?.pendingCount ?? 0} migration(s) pendente(s).`,
        badge: `${summary.migrations?.pendingCount ?? 0}/${summary.migrations?.driftedCount ?? 0}`,
      },
      {
        id: "postura-operacional",
        title: "Postura",
        description: `${summary.operationalSummary.failureCount24h} falha(s) operacional(is) nas ultimas 24h.`,
        badge: `${summary.operationalSummary.failureCount24h}`,
      },
      {
        id: "incidentes-recentes",
        title: "Incidentes",
        description: `${summary.incidentSummary.errorTotal} erro(s) e ${summary.incidentSummary.warnTotal} aviso(s) desde o ultimo start.`,
        badge: `${summary.incidentSummary.total}`,
      },
      {
        id: "operacoes-recentes",
        title: "Operacoes",
        description: `${summary.operationalEvents.length} evento(s) operacional(is) recente(s) visiveis no feed.`,
        badge: `${summary.operationalEvents.length}`,
      },
      {
        id: "governanca-casos",
        title: "Fila",
        description: `${summary.caseManagementReport.overdueTotal} vencido(s), ${summary.caseManagementReport.withoutSetorTotal} sem setor e ${summary.caseManagementReport.withoutInteressadosTotal} sem envolvidos.`,
        badge: `${summary.caseManagementReport.prioritySetores.length}`,
      },
    ],
    [summary],
  );
  const activeSection = location.hash.replace(/^#/, "");
  const primaryAttentionItem = attentionItems[0] ?? null;
  const responsePathItems = attentionItems.slice(0, 3);
  const topIncidentCluster = summary.incidentSummary.clusters[0] ?? null;
  const topFailureCluster = summary.operationalSummary.failureClusters24h[0] ?? null;
  const recurrencePathItems = [
    ...summary.incidentSummary.clusters
      .filter((cluster) => cluster.total >= 2)
      .map((cluster) => ({
        key: `incident-${cluster.key}`,
        title: describeIncident({
          id: cluster.key,
          kind: cluster.kind,
          level: cluster.level,
          message: "",
          occurredAt: cluster.lastOccurredAt,
          requestId: null,
          userId: null,
          method: null,
          path: cluster.path,
          statusCode: null,
        }),
        description: cluster.path ? `Cluster repetido na rota ${cluster.path}.` : "Cluster repetido sem rota dominante associada.",
        total: cluster.total,
        tone: cluster.level === "error" ? "critical" : ("attention" as const),
        href: "#incidentes-recentes",
        cta: "Abrir incidentes",
      })),
    ...summary.operationalSummary.failureClusters24h
      .filter((cluster) => cluster.total >= 2)
      .map((cluster) => ({
        key: `failure-${cluster.key}`,
        title: describeOperationalEventKind(cluster.kind),
        description: `Recorrencia em ${cluster.source}${cluster.reference ? ` - ref ${cluster.reference}` : ""}.`,
        total: cluster.total,
        tone: "attention" as const,
        href: "#operacoes-recentes",
        cta: "Abrir operacoes",
      })),
  ]
    .sort((left, right) => right.total - left.total)
    .slice(0, 3);
  const suggestedDecision =
    primaryAttentionItem && recurrencePathItems[0] && primaryAttentionItem.area === "Incidentes"
      ? {
          title: "Abrir incidente recorrente antes dos demais alertas",
          description:
            "A anomalia principal e a recorrencia atual apontam para o mesmo eixo de incidente. Vale atacar primeiro o cluster repetido para cortar ruido e impacto mais rapido.",
          confidence: "Alta",
          urgencyReason: "Ha convergencia entre prioridade atual e repeticao recente.",
          effortHint: "Intervencao rapida",
          impactHint: "Reduz ruido e corta repeticao logo no inicio.",
          href: recurrencePathItems[0].href,
          cta: recurrencePathItems[0].cta,
        }
      : primaryAttentionItem && recurrencePathItems[0] && primaryAttentionItem.area === "Operacoes"
        ? {
            title: "Investigar falha operacional repetida antes da fila",
            description:
              "O topo da triagem e a repeticao recente estao concentrados em operacoes. A melhor resposta imediata e estabilizar esse cluster antes de tratar efeitos secundarios.",
            confidence: "Alta",
            urgencyReason: "A instabilidade operacional ja esta a repetir e tende a contaminar outras leituras.",
            effortHint: "Investigacao curta",
            impactHint: "Estabiliza a base operacional antes de efeitos em cascata.",
            href: recurrencePathItems[0].href,
            cta: recurrencePathItems[0].cta,
          }
        : primaryAttentionItem
          ? {
              title: "Seguir a maior anomalia do momento",
              description: "Nao ha convergencia forte por repeticao nesta janela. O melhor proximo passo continua a ser a anomalia principal destacada acima.",
              confidence: "Media",
              urgencyReason: "Nao surgiu um cluster repetido mais forte do que a anomalia principal.",
              effortHint: "Triagem dirigida",
              impactHint: "Mantem o foco na frente mais relevante da janela atual.",
              href: primaryAttentionItem.href,
              cta: primaryAttentionItem.cta,
            }
          : null;

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

      {primaryAttentionItem ? (
        <Card className={primaryAttentionItem.tone === "critical" ? "border-rose-200 bg-rose-50/80" : "border-amber-200 bg-amber-50/80"}>
          <CardHeader>
            <CardTitle>Maior anomalia do momento</CardTitle>
            <CardDescription>Leitura unica do ponto mais prioritario entre saude tecnica, operacao e fila.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                  {primaryAttentionItem.area}
                </span>
                <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                  {primaryAttentionItem.tone === "critical" ? "Critico" : "Atencao"}
                </span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{primaryAttentionItem.title}</h2>
                <p className="mt-1 text-sm text-slate-700">{primaryAttentionItem.description}</p>
              </div>
              {primaryAttentionItem.trend ? (
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{primaryAttentionItem.trend}</p>
              ) : null}
            </div>
            {primaryAttentionItem.href && primaryAttentionItem.cta ? (
              <div>
                <Button asChild variant="secondary">
                  <Link to={primaryAttentionItem.href}>{primaryAttentionItem.cta}</Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {responsePathItems.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Trilha de resposta</CardTitle>
            <CardDescription>Sequencia curta sugerida para atacar os pontos mais prioritarios desta janela operacional.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 xl:grid-cols-3">
            {responsePathItems.map((item, index) => (
              <article className="grid gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-4" key={`response-${item.title}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Passo {index + 1}</p>
                    <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.title}</h3>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                      item.tone === "critical" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {item.area}
                  </span>
                </div>
                <p className="text-sm text-slate-700">{item.description}</p>
                {item.trend ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.trend}</p> : null}
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

      {topIncidentCluster || topFailureCluster ? (
        <Card>
          <CardHeader>
            <CardTitle>Recorrencia recente</CardTitle>
            <CardDescription>Agrupamentos que ajudam a distinguir ruido ocasional de problema repetido.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 xl:grid-cols-2">
            {topIncidentCluster ? (
              <article
                className={`grid gap-3 rounded-[24px] border px-4 py-4 ${
                  topIncidentCluster.level === "error" ? "border-rose-200 bg-rose-50/80" : "border-amber-200 bg-amber-50/80"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Cluster de incidente</p>
                    <h3 className="mt-1 text-sm font-semibold text-slate-950">
                      {describeIncident({
                        id: topIncidentCluster.key,
                        kind: topIncidentCluster.kind,
                        level: topIncidentCluster.level,
                        message: "",
                        occurredAt: topIncidentCluster.lastOccurredAt,
                        requestId: null,
                        userId: null,
                        method: null,
                        path: topIncidentCluster.path,
                        statusCode: null,
                      })}
                    </h3>
                  </div>
                  <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                    {topIncidentCluster.total}x
                  </span>
                </div>
                <p className="text-sm text-slate-700">{topIncidentCluster.path ? `Rota dominante: ${topIncidentCluster.path}` : "Sem rota dominante associada."}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {new Date(topIncidentCluster.firstOccurredAt).toLocaleString("pt-BR")} ate {new Date(topIncidentCluster.lastOccurredAt).toLocaleString("pt-BR")}
                </p>
                <div>
                  <Button asChild size="sm" variant="secondary">
                    <Link to="#incidentes-recentes">Ver cluster</Link>
                  </Button>
                </div>
              </article>
            ) : null}
            {topFailureCluster ? (
              <article className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Cluster operacional</p>
                    <h3 className="mt-1 text-sm font-semibold text-slate-950">{describeOperationalEventKind(topFailureCluster.kind)}</h3>
                  </div>
                  <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                    {topFailureCluster.total}x
                  </span>
                </div>
                <p className="text-sm text-slate-700">
                  Origem {topFailureCluster.source}
                  {topFailureCluster.reference ? ` - ref ${topFailureCluster.reference}` : ""}
                </p>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {new Date(topFailureCluster.firstOccurredAt).toLocaleString("pt-BR")} ate {new Date(topFailureCluster.lastOccurredAt).toLocaleString("pt-BR")}
                </p>
                <div>
                  <Button asChild size="sm" variant="secondary">
                    <Link to="#operacoes-recentes">Ver cluster</Link>
                  </Button>
                </div>
              </article>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {recurrencePathItems.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Ataque por repeticao</CardTitle>
            <CardDescription>Clusters que ja repetiram o suficiente para justificar investigacao directa.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 xl:grid-cols-3">
            {recurrencePathItems.map((item, index) => (
              <article
                className={`grid gap-3 rounded-[24px] border px-4 py-4 ${
                  item.tone === "critical" ? "border-rose-200 bg-rose-50/80" : "border-amber-200 bg-amber-50/80"
                }`}
                key={item.key}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Foco {index + 1}</p>
                    <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.title}</h3>
                  </div>
                  <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                    {item.total}x
                  </span>
                </div>
                <p className="text-sm text-slate-700">{item.description}</p>
                <div>
                  <Button asChild size="sm" variant="secondary">
                    <Link to={item.href}>{item.cta}</Link>
                  </Button>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {suggestedDecision ? (
        <Card>
          <CardHeader>
            <CardTitle>Decisao sugerida</CardTitle>
            <CardDescription>Sintese curta do que parece render a melhor resposta imediata nesta janela.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 rounded-[24px] border border-sky-200 bg-sky-50/70 px-4 py-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-700">Proximo passo recomendado</p>
                <span className="rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                  Confianca {suggestedDecision.confidence}
                </span>
              </div>
              <h3 className="mt-1 text-base font-semibold text-slate-950">{suggestedDecision.title}</h3>
            </div>
            <p className="text-sm text-slate-700">{suggestedDecision.description}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Porque agora: {suggestedDecision.urgencyReason}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Esforco esperado: {suggestedDecision.effortHint}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Impacto esperado: {suggestedDecision.impactHint}</p>
            {suggestedDecision.href && suggestedDecision.cta ? (
              <div>
                <Button asChild variant="secondary">
                  <Link to={suggestedDecision.href}>{suggestedDecision.cta}</Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {attentionItems.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Atencao imediata</CardTitle>
            <CardDescription>Itens que exigem acao mais rapida com base na saude da aplicacao, operacao e fila atual.</CardDescription>
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

      <Card>
        <CardHeader>
          <CardTitle>Mapa operacional</CardTitle>
          <CardDescription>Entradas directas para as areas de investigacao e execucao mais usadas no painel.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-3">
          {quickSectionLinks.map((item) => (
            <article
              className={`grid gap-3 rounded-[24px] border px-4 py-4 ${
                activeSection === item.id ? "border-sky-300 bg-sky-50/70 shadow-[0_0_0_3px_rgba(14,165,233,0.12)]" : "border-slate-200 bg-white"
              }`}
              key={item.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{item.title}</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.description}</h3>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                  {item.badge}
                </span>
              </div>
              <div>
                <Button asChild size="sm" variant="secondary">
                  <Link to={`#${item.id}`}>Abrir secao</Link>
                </Button>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

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

      <AdminOperationsQueueSection report={summary.caseManagementReport} />

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminOperationsRuntimeSection runtime={summary.runtime} />

        <Card>
          <CardHeader>
            <CardTitle>Regras da fila</CardTitle>
            <CardDescription>Limiar operacional para sinalizar processos em atencao ou criticos.</CardDescription>
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
                    setMessage("Regras da fila atualizadas com sucesso.");
                    await load();
                  } catch (nextError) {
                    setError(formatAppError(nextError, "Falha ao atualizar regras da fila."));
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

      <AdminOperationsBackupSection backupStatus={summary.backupStatus} activeSection={activeSection} />

        <AdminOperationsSchemaSection migrations={summary.migrations} activeSection={activeSection} />

        <AdminOperationsPostureSection operationalSummary={summary.operationalSummary} activeSection={activeSection} />
      </div>

      <AdminOperationsIncidentsSection incidentSummary={summary.incidentSummary} incidents={summary.incidents} activeSection={activeSection} />

      <AdminOperationsEventsSection operationalEvents={summary.operationalEvents} activeSection={activeSection} />
    </section>
  );
}
