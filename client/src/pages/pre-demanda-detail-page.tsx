import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/confirm-dialog";
import { FormField } from "../components/form-field";
import { PageHeader } from "../components/page-header";
import { QueueHealthPill } from "../components/queue-health-pill";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { StatusPill } from "../components/status-pill";
import { Timeline } from "../components/timeline";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { associateSei, formatAppError, getPreDemanda, getTimeline, updatePreDemandaStatus } from "../lib/api";
import { formatPreDemandaMutationError } from "../lib/pre-demanda-feedback";
import { formatAllowedStatuses, getPreferredReopenStatus, getPreDemandaStatusLabel } from "../lib/pre-demanda-status";
import { getQueueHealth } from "../lib/queue-health";
import { formatSeiInput, isValidSei, normalizeSeiValue } from "../lib/sei";
import type { PreDemanda, PreDemandaStatus, TimelineEvent } from "../types";

type StatusAction = {
  nextStatus: PreDemandaStatus;
  title: string;
  requireReason: boolean;
};

export function PreDemandaDetailPage() {
  const { preId = "" } = useParams();
  const [record, setRecord] = useState<PreDemanda | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);
  const [associationForm, setAssociationForm] = useState({
    sei_numero: "",
    motivo: "",
    observacoes: "",
  });
  const isSeiValid = isValidSei(associationForm.sei_numero);

  async function load() {
    setLoading(true);

    try {
      const [nextRecord, nextTimeline] = await Promise.all([getPreDemanda(preId), getTimeline(preId)]);
      setRecord(nextRecord);
      setTimeline(nextTimeline);
      setAssociationForm((current) => ({
        ...current,
        sei_numero: nextRecord.currentAssociation?.seiNumero ?? normalizeSeiValue(current.sei_numero),
      }));
      setError("");
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao carregar demanda."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [preId]);

  async function handleAssociation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!isSeiValid) {
      setError("Informe um numero SEI no formato 0000000-00.0000.0.00.0000.");
      return;
    }

    try {
      const response = await associateSei(preId, {
        ...associationForm,
        sei_numero: normalizeSeiValue(associationForm.sei_numero),
      });
      setMessage(response.audited ? "SEI reassociado com auditoria registada." : "SEI associado com sucesso.");
      await load();
    } catch (nextError) {
      setError(formatPreDemandaMutationError(nextError, "Falha ao associar SEI."));
    }
  }

  const nextAction = useMemo(() => {
    if (!record) {
      return {
        title: "",
        description: "",
      };
    }

    switch (record.status) {
      case "aberta":
        return {
          title: "Triar e decidir o fluxo",
          description: "Validar o contexto da solicitacao e decidir se a demanda segue para aguardando SEI ou se ja pode receber vinculacao.",
        };
      case "aguardando_sei":
        return {
          title: "Aguardar e monitorar o processo",
          description: "Acompanhar o nascimento do processo e associar o numero SEI assim que estiver disponivel.",
        };
      case "associada":
        return {
          title: "Conferir e concluir",
          description: "Confirmar o contexto do processo vinculado e encerrar a demanda quando a acao administrativa estiver concluida.",
        };
      case "encerrada":
        return {
          title: "Manter encerrada, salvo excecao",
          description: "Reabrir apenas se houver nova necessidade operacional, correcao de fluxo ou vinculacao feita com erro.",
        };
      default:
        return {
          title: "",
          description: "",
        };
    }
  }, [record]);

  const lastEvent = useMemo(() => timeline[0] ?? null, [timeline]);

  if (loading) {
    return <LoadingState description="A timeline, o estado e o vinculo SEI estao a ser preparados." title="Carregando demanda" />;
  }

  if (error && !record) {
    return <ErrorState description={error} />;
  }

  if (!record) {
    return <ErrorState description="Demanda nao encontrada." />;
  }

  const queueHealth = getQueueHealth(record);

  return (
    <section className="grid gap-6">
      <PageHeader
        actions={
          <>
            {record.allowedNextStatuses.includes("encerrada") ? (
              <Button onClick={() => setStatusAction({ nextStatus: "encerrada", title: "Encerrar demanda", requireReason: true })} type="button" variant="secondary">
                Encerrar
              </Button>
            ) : record.status === "encerrada" && getPreferredReopenStatus(record) ? (
              <Button
                onClick={() =>
                  setStatusAction({
                    nextStatus: getPreferredReopenStatus(record)!,
                    title: "Reabrir demanda",
                    requireReason: true,
                  })
                }
                type="button"
                variant="secondary"
              >
                Reabrir
              </Button>
            ) : null}
            {record.allowedNextStatuses.includes("aguardando_sei") ? (
              <Button onClick={() => setStatusAction({ nextStatus: "aguardando_sei", title: "Marcar como aguardando SEI", requireReason: false })} type="button" variant="ghost">
                Marcar aguardando SEI
              </Button>
            ) : null}
          </>
        }
        description="Resumo operativo, estado actual e trilha cronologica completa da pre-demanda."
        eyebrow={record.preId}
        title={record.assunto}
      />

      {error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Resumo executivo</CardTitle>
                <div className="flex flex-wrap justify-end gap-2">
                  <StatusPill status={record.status} />
                  <QueueHealthPill item={record} />
                </div>
              </div>
              <CardDescription>{nextAction.description}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm text-slate-600">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Solicitante</p>
                <p className="mt-1 text-slate-950">{record.solicitante}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Data de referencia</p>
                <p className="mt-1 text-slate-950">{new Date(record.dataReferencia).toLocaleDateString("pt-BR")}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Criada por</p>
                <p className="mt-1 text-slate-950">{record.createdBy ? `${record.createdBy.name} (${record.createdBy.email})` : "Autor nao informado"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Fonte</p>
                <p className="mt-1 text-slate-950">{record.fonte ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Descricao</p>
                <p className="mt-1 text-slate-950">{record.descricao ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Observacoes</p>
                <p className="mt-1 text-slate-950">{record.observacoes ?? "-"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proxima acao operacional</CardTitle>
              <CardDescription>{nextAction.title}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm text-slate-600">
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
                <p className="text-sm font-semibold text-amber-900">{nextAction.title}</p>
                <p className="mt-2 text-sm text-amber-800">{nextAction.description}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">SEI actual</p>
                <p className="mt-1 text-slate-950">{record.currentAssociation?.seiNumero ?? "Ainda nao associado"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Saude da fila</p>
                <p className="mt-1 text-slate-950">{queueHealth.summary}</p>
                <p className="mt-1 text-xs text-slate-500">{queueHealth.detail}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Ultima movimentacao</p>
                <p className="mt-1 text-slate-950">
                  {lastEvent ? `${new Date(lastEvent.occurredAt).toLocaleString("pt-BR")} - ${lastEvent.actor ? lastEvent.actor.name : "Sistema"}` : "Nenhum evento registado"}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Pendencia principal</p>
                <p className="mt-1 text-slate-950">
                  {record.status === "aguardando_sei"
                    ? "Associar o numero SEI assim que o processo existir."
                    : record.status === "aberta"
                      ? "Classificar e mover a demanda para o proximo estado."
                      : record.status === "associada"
                        ? "Concluir a tratativa e encerrar quando apropriado."
                        : "Sem pendencia activa, apenas monitorar necessidade de reabertura."}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Proximos estados permitidos</p>
                <p className="mt-1 text-slate-950">
                  {record.allowedNextStatuses.length ? formatAllowedStatuses(record.allowedNextStatuses) : "Nenhuma transicao manual disponivel"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Associacao PRE para SEI</CardTitle>
              <CardDescription>
                SEI actual: {record.currentAssociation?.seiNumero ?? "nao associado"}
                {record.currentAssociation?.linkedBy ? ` - vinculado por ${record.currentAssociation.linkedBy.name}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleAssociation}>
                <FormField
                  hint={
                    <>
                      Formato aceite: <code>0000000-00.0000.0.00.0000</code>. Entradas parciais podem aparecer como <code>000000/00-00.000</code>.
                    </>
                  }
                  label="Numero SEI"
                >
                  <Input
                    onChange={(event) => setAssociationForm((current) => ({ ...current, sei_numero: formatSeiInput(event.target.value) }))}
                    placeholder="0000000-00.0000.0.00.0000"
                    value={associationForm.sei_numero}
                  />
                </FormField>

                <FormField label="Motivo">
                  <Textarea onChange={(event) => setAssociationForm((current) => ({ ...current, motivo: event.target.value }))} rows={3} value={associationForm.motivo} />
                </FormField>

                <FormField label="Observacoes">
                  <Textarea onChange={(event) => setAssociationForm((current) => ({ ...current, observacoes: event.target.value }))} rows={3} value={associationForm.observacoes} />
                </FormField>

                <div className="flex justify-end">
                  <Button disabled={!isSeiValid} type="submit">
                    Salvar associacao
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Timeline operacional</CardTitle>
            <CardDescription>Historico unificado de criacao, mudancas de estado e vinculacoes PRE para SEI.</CardDescription>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <EmptyState description="Assim que houver criacao, mudanca de status ou vinculacao SEI, os eventos aparecerao aqui." title="Sem eventos registados" />
            ) : (
              <Timeline events={timeline} />
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        confirmLabel={statusAction?.title ?? "Confirmar alteracao"}
        description="Registre o motivo da mudanca para manter a trilha de auditoria completa."
        onConfirm={async ({ motivo, observacoes }) => {
          if (!statusAction) {
            return;
          }

          try {
            setError("");
            setMessage("");
            await updatePreDemandaStatus(preId, {
              status: statusAction.nextStatus,
              motivo,
              observacoes,
            });
            setMessage(`Demanda actualizada para ${getPreDemandaStatusLabel(statusAction.nextStatus)}.`);
            await load();
          } catch (nextError) {
            throw new Error(formatPreDemandaMutationError(nextError, "Falha ao atualizar a demanda."));
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setStatusAction(null);
          }
        }}
        open={Boolean(statusAction)}
        requireReason={statusAction?.requireReason}
        title={statusAction?.title ?? "Alterar status"}
      />
    </section>
  );
}
