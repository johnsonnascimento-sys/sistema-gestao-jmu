import { MetricCard } from "../components/metric-card";
import { EmptyState } from "../components/states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import type { AdminOpsSummary } from "../types";
import {
  describeIncident,
  describeOperationalEvent,
  describeOperationalEventKind,
  formatBytes,
  formatEventMoment,
  formatUptime,
  freshnessTone,
  sectionCardClass,
} from "./admin-operations-utils";

export function AdminOperationsRuntimeSection({
  runtime,
}: {
  runtime: AdminOpsSummary["runtime"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Runtime atual</CardTitle>
        <CardDescription>Dados do processo atualmente em execucao.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm text-slate-600">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Versao</p>
          <p className="mt-1 text-slate-950">
            v{runtime.version}
            {runtime.commitSha ? ` - ${runtime.commitSha}` : ""}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Ambiente</p>
          <p className="mt-1 text-slate-950">{runtime.environment}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Uptime</p>
          <p className="mt-1 text-slate-950">{formatUptime(runtime.uptimeSeconds)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Iniciado em</p>
          <p className="mt-1 text-slate-950">{new Date(runtime.startedAt).toLocaleString("pt-BR")}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Banco</p>
          <p className="mt-1 text-slate-950">
            {runtime.database?.status === "ready"
              ? `Pronto - ${runtime.database.latencyMs ?? 0} ms`
              : `Falha - ${runtime.database?.message ?? "Sem detalhe."}`}
          </p>
          {runtime.database?.checkedAt ? (
            <p className="mt-1 text-xs text-slate-500">
              Verificado em {new Date(runtime.database.checkedAt).toLocaleString("pt-BR")}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminOperationsBackupSection({
  backupStatus,
  activeSection,
}: {
  backupStatus: AdminOpsSummary["backupStatus"];
  activeSection: string;
}) {
  return (
    <Card className={sectionCardClass(activeSection === "backups")} id="backups">
      <CardHeader>
        <CardTitle>Backups visiveis</CardTitle>
        <CardDescription>
          Ultimos dumps acessiveis ao container para conferencias e resposta a incidente.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm text-slate-600">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Diretorio montado</p>
          <p className="mt-1 text-slate-950">{backupStatus.directory}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Schema</p>
          <p className="mt-1 text-slate-950">{backupStatus.schemaName}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Ultimo backup valido</p>
          {backupStatus.lastBackup ? (
            <>
              <p className="mt-1 text-slate-950">{backupStatus.lastBackup.fileName}</p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(backupStatus.lastBackup.modifiedAt).toLocaleString("pt-BR")} -{" "}
                {formatBytes(backupStatus.lastBackup.sizeBytes)}
              </p>
            </>
          ) : (
            <p className="mt-1 text-slate-950">Nenhum backup visivel</p>
          )}
        </div>
        {backupStatus.message ? (
          <p className="rounded-[20px] border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm text-amber-900">
            {backupStatus.message}
          </p>
        ) : null}
        {backupStatus.recentBackups.length ? (
          <div className="grid gap-2">
            {backupStatus.recentBackups.map((backup) => (
              <article
                className="rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-3"
                key={backup.fileName}
              >
                <p className="text-sm font-semibold text-slate-950">{backup.fileName}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(backup.modifiedAt).toLocaleString("pt-BR")} - {formatBytes(backup.sizeBytes)}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            description="Assim que o volume de backup estiver montado e houver dumps validos, eles aparecerao aqui."
            title="Sem backups visiveis"
          />
        )}
      </CardContent>
    </Card>
  );
}

export function AdminOperationsSchemaSection({
  migrations,
  activeSection,
}: {
  migrations: AdminOpsSummary["migrations"] | null;
  activeSection: string;
}) {
  return (
    <Card className={sectionCardClass(activeSection === "migracoes")} id="migracoes">
      <CardHeader>
        <CardTitle>Migracoes de schema</CardTitle>
        <CardDescription>
          Comparacao entre os scripts versionados e o que o banco reporta como aplicado.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm text-slate-600">
        {migrations ? (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Total</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{migrations.totalFiles}</p>
              </div>
              <div className="rounded-[22px] border border-emerald-200 bg-emerald-50/70 px-3 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-emerald-700">Aplicadas</p>
                <p className="mt-2 text-lg font-semibold text-emerald-950">{migrations.appliedCount}</p>
              </div>
              <div className="rounded-[22px] border border-amber-200 bg-amber-50/70 px-3 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-amber-700">Pendentes</p>
                <p className="mt-2 text-lg font-semibold text-amber-950">{migrations.pendingCount}</p>
              </div>
              <div className="rounded-[22px] border border-rose-200 bg-rose-50/70 px-3 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-rose-700">Drift</p>
                <p className="mt-2 text-lg font-semibold text-rose-950">{migrations.driftedCount}</p>
              </div>
            </div>

            <div className="grid gap-2">
              {migrations.items.map((item) => (
                <article
                  className="flex flex-col gap-2 rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-3 md:flex-row md:items-center md:justify-between"
                  key={item.version}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{item.version}</p>
                    <p className="text-xs text-slate-500">
                      {item.appliedAt
                        ? `Aplicada em ${new Date(item.appliedAt).toLocaleString("pt-BR")}`
                        : "Ainda nao aplicada"}
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
          <EmptyState
            description="O resumo de migracoes volta a aparecer assim que o banco responder normalmente."
            title="Migracoes indisponiveis"
          />
        )}
      </CardContent>
    </Card>
  );
}

export function AdminOperationsPostureSection({
  operationalSummary,
  activeSection,
}: {
  operationalSummary: AdminOpsSummary["operationalSummary"];
  activeSection: string;
}) {
  return (
    <Card className={sectionCardClass(activeSection === "postura-operacional")} id="postura-operacional">
      <CardHeader>
        <CardTitle>Postura operacional</CardTitle>
        <CardDescription>
          Leitura rapida do ultimo backup, deploy, drill e monitorizacao para reduzir a necessidade de inspecionar
          o feed completo.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm text-slate-600">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Freshness do backup</p>
            <p className="mt-1 text-slate-950">
              {operationalSummary.backupAgeHours === null
                ? "Sem backup confirmado"
                : `${operationalSummary.backupAgeHours} h desde o ultimo backup`}
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${freshnessTone(operationalSummary.backupFreshness)}`}
          >
            {operationalSummary.backupFreshness}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 px-3 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ultimo backup OK</p>
            <p className="mt-2 font-semibold text-slate-950">
              {formatEventMoment(operationalSummary.lastSuccessfulBackupAt)}
            </p>
          </div>
          <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 px-3 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ultimo deploy OK</p>
            <p className="mt-2 font-semibold text-slate-950">
              {formatEventMoment(operationalSummary.lastSuccessfulDeployAt)}
            </p>
          </div>
          <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 px-3 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ultimo drill OK</p>
            <p className="mt-2 font-semibold text-slate-950">
              {formatEventMoment(operationalSummary.lastSuccessfulRestoreDrillAt)}
            </p>
          </div>
          <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 px-3 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ultima auditoria OK</p>
            <p className="mt-2 font-semibold text-slate-950">
              {formatEventMoment(operationalSummary.lastSuccessfulBootstrapAuditAt)}
            </p>
          </div>
        </div>
        <div
          className={`rounded-[20px] border px-4 py-3 ${operationalSummary.lastFailedMonitorAt ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          <p className="text-xs font-bold uppercase tracking-[0.22em]">Monitorizacao</p>
          <p className="mt-2 font-semibold">
            {operationalSummary.lastFailedMonitorAt
              ? `Ultima falha em ${formatEventMoment(operationalSummary.lastFailedMonitorAt)}`
              : "Sem falhas recentes de monitorizacao"}
          </p>
          {operationalSummary.lastFailedMonitorMessage ? (
            <p className="mt-1 text-xs">{operationalSummary.lastFailedMonitorMessage}</p>
          ) : null}
        </div>
        <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
            Falhas operacionais 24h
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-950">
            {operationalSummary.failureCount24h}
          </p>
          {operationalSummary.failuresByKind24h.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {operationalSummary.failuresByKind24h.map((item) => (
                <span
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700"
                  key={`failure-kind-${item.kind}`}
                >
                  {describeOperationalEvent({
                    id: item.kind,
                    kind: item.kind,
                    status: "failure",
                    source: "",
                    message: "",
                    reference: null,
                    occurredAt: new Date().toISOString(),
                  })}{" "}
                  {item.total}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              Nenhuma falha operacional registrada nas ultimas 24 horas.
            </p>
          )}
        </div>
        {operationalSummary.failureClusters24h.length ? (
          <div className="grid gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Falhas agrupadas</p>
            <div className="grid gap-3">
              {operationalSummary.failureClusters24h.map((cluster) => (
                <article
                  className="rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-3"
                  key={cluster.key}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {describeOperationalEventKind(cluster.kind)}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {cluster.total} ocorrencia(s) - origem {cluster.source}
                        {cluster.reference ? ` - ref ${cluster.reference}` : ""}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">
                      {new Date(cluster.firstOccurredAt).toLocaleString("pt-BR")} ate{" "}
                      {new Date(cluster.lastOccurredAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{cluster.lastMessage}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AdminOperationsIncidentsSection({
  incidentSummary,
  incidents,
  activeSection,
}: {
  incidentSummary: AdminOpsSummary["incidentSummary"];
  incidents: AdminOpsSummary["incidents"];
  activeSection: string;
}) {
  return (
    <Card className={sectionCardClass(activeSection === "incidentes-recentes")} id="incidentes-recentes">
      <CardHeader>
        <CardTitle>Incidentes recentes</CardTitle>
        <CardDescription>Eventos registrados desde o ultimo arranque do processo.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">{incidentSummary.total}</p>
          </div>
          <div className="rounded-[20px] border border-amber-200 bg-amber-50/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-700">Warn</p>
            <p className="mt-2 text-lg font-semibold text-amber-950">{incidentSummary.warnTotal}</p>
          </div>
          <div className="rounded-[20px] border border-rose-200 bg-rose-50/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-rose-700">Error</p>
            <p className="mt-2 text-lg font-semibold text-rose-950">{incidentSummary.errorTotal}</p>
          </div>
          <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ultimo incidente</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">
              {formatEventMoment(incidentSummary.latestOccurredAt)}
            </p>
          </div>
        </div>
        {incidentSummary.byKind.length ? (
          <div className="flex flex-wrap gap-2">
            {incidentSummary.byKind.map((item) => (
              <span
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700"
                key={`incident-kind-${item.kind}`}
              >
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
                })}{" "}
                {item.total}
              </span>
            ))}
          </div>
        ) : null}
        {incidentSummary.topPaths.length ? (
          <div className="grid gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Rotas mais afectadas</p>
            <div className="flex flex-wrap gap-2">
              {incidentSummary.topPaths.map((item) => (
                <span
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700"
                  key={`incident-path-${item.path}`}
                >
                  {item.path} {item.total}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {incidentSummary.clusters.length ? (
          <div className="grid gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Incidentes agrupados</p>
            <div className="grid gap-3">
              {incidentSummary.clusters.map((cluster) => (
                <article
                  className={`rounded-[20px] border px-4 py-3 ${
                    cluster.level === "error" ? "border-rose-200 bg-rose-50/70" : "border-amber-200 bg-amber-50/70"
                  }`}
                  key={cluster.key}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {describeIncident({
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
                        })}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {cluster.total} ocorrencia(s)
                        {cluster.path ? ` - ${cluster.path}` : " - sem rota associada"}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">
                      {new Date(cluster.firstOccurredAt).toLocaleString("pt-BR")} ate{" "}
                      {new Date(cluster.lastOccurredAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
        {incidents.length === 0 ? (
          <EmptyState
            description="Quando houver falha de autenticacao, erro interno ou problema de prontidao, os eventos aparecerao aqui."
            title="Nenhum incidente desde o ultimo start"
          />
        ) : (
          incidents.map((incident) => (
            <article
              className={`grid gap-2 rounded-[24px] border px-4 py-4 ${
                incident.level === "error" ? "border-rose-200 bg-rose-50/80" : "border-amber-200 bg-amber-50/80"
              }`}
              key={incident.id}
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                    {incident.kind.replaceAll("_", " ")}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-950">{describeIncident(incident)}</h3>
                </div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  {new Date(incident.occurredAt).toLocaleString("pt-BR")}
                </p>
              </div>
              <p className="text-sm text-slate-700">{incident.message}</p>
              <p className="text-xs text-slate-500">
                {[
                  incident.method,
                  incident.path,
                  incident.statusCode ? `HTTP ${incident.statusCode}` : null,
                  incident.requestId ? `req ${incident.requestId}` : null,
                ]
                  .filter(Boolean)
                  .join(" - ")}
              </p>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function AdminOperationsEventsSection({
  operationalEvents,
  activeSection,
}: {
  operationalEvents: AdminOpsSummary["operationalEvents"];
  activeSection: string;
}) {
  return (
    <Card className={sectionCardClass(activeSection === "operacoes-recentes")} id="operacoes-recentes">
      <CardHeader>
        <CardTitle>Operacoes recentes</CardTitle>
        <CardDescription>
          Backups, deploys, rollbacks, drills e auditorias executadas fora do processo da aplicacao.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {operationalEvents.length === 0 ? (
          <EmptyState
            description="Assim que backup, deploy, rollback, monitoracao ou auditoria registrar eventos, eles aparecerao aqui."
            title="Sem operacoes registradas"
          />
        ) : (
          operationalEvents.map((event) => (
            <article
              className={`grid gap-2 rounded-[24px] border px-4 py-4 ${
                event.status === "failure" ? "border-rose-200 bg-rose-50/80" : "border-emerald-200 bg-emerald-50/80"
              }`}
              key={event.id}
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                    {describeOperationalEvent(event)}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-950">{event.message}</h3>
                </div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  {new Date(event.occurredAt).toLocaleString("pt-BR")}
                </p>
              </div>
              <p className="text-sm text-slate-700">
                {event.status === "failure" ? "Falha operacional registrada." : "Execucao concluida com sucesso."}
                {event.reference ? ` Referencia: ${event.reference}` : ""}
              </p>
              <p className="text-xs text-slate-500">Origem: {event.source}</p>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
