import { useEffect, useState } from "react";
import { useAuth } from "../auth-context";
import { MetricCard } from "../components/metric-card";
import { PageHeader } from "../components/page-header";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { formatAppError, getAdminOpsSummary, updateQueueHealthConfig } from "../lib/api";
import type { AdminOpsSummary, OperationsIncident } from "../types";

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

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminOperationsPage() {
  const { hasPermission } = useAuth();
  const [summary, setSummary] = useState<AdminOpsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [queueThresholds, setQueueThresholds] = useState({
    attentionDays: "2",
    criticalDays: "5",
  });
  const [savingQueueThresholds, setSavingQueueThresholds] = useState(false);

  async function load() {
    setLoading(true);

    try {
      const nextSummary = await getAdminOpsSummary(12);
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
  }, []);

  if (loading) {
    return <LoadingState description="A consolidar runtime, contadores, migracoes e incidentes recentes." title="Carregando operacoes" />;
  }

  if (error && !summary) {
    return <ErrorState description={error} />;
  }

  if (!summary) {
    return <ErrorState description="Resumo operacional indisponivel." />;
  }

  return (
    <section className="grid gap-6">
      <PageHeader
        actions={
          <Button onClick={() => void load()} type="button" variant="secondary">
            Atualizar
          </Button>
        }
        description="Monitoramento minimo da aplicacao, com visao do runtime, do schema e dos incidentes desde o ultimo start."
        eyebrow="Operacoes"
        title="Saude e observabilidade"
      />

      {error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div> : null}

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

        <Card>
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

        <Card>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Incidentes recentes</CardTitle>
          <CardDescription>Eventos registados desde o ultimo arranque do processo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
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
    </section>
  );
}
