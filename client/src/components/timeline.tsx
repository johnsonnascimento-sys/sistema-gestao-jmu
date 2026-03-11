import type { TimelineEvent } from "../types";
import { Badge } from "./ui/badge";

function getEventLabel(event: TimelineEvent) {
  switch (event.type) {
    case "created":
      return "Demanda criada";
    case "status_changed":
      return event.statusNovo ? `Status alterado para ${event.statusNovo.replace("_", " ")}` : "Status alterado";
    case "sei_linked":
      return "Associacao inicial ao SEI";
    case "sei_reassociated":
      return "SEI reassociado";
    case "tramitation":
      return "Tramitacao";
    case "task_completed":
      return "Tarefa concluida";
    case "interessado_added":
      return "Pessoa vinculada";
    case "interessado_removed":
      return "Pessoa removida";
    case "vinculo_added":
      return "Processo relacionado";
    case "vinculo_removed":
      return "Vinculo removido";
    case "andamento":
      return "Andamento";
    default:
      return "Evento";
  }
}

function getEventTone(event: TimelineEvent) {
  switch (event.type) {
    case "sei_reassociated":
      return "warning" as const;
    case "sei_linked":
      return "success" as const;
    case "status_changed":
      return event.statusNovo === "encerrada" ? ("destructive" as const) : ("outline" as const);
    case "tramitation":
      return "outline" as const;
    case "task_completed":
      return "success" as const;
    case "interessado_added":
    case "vinculo_added":
      return "success" as const;
    case "interessado_removed":
    case "vinculo_removed":
      return "warning" as const;
    default:
      return "outline" as const;
  }
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="relative grid gap-4 pl-6 before:absolute before:bottom-0 before:left-2 before:top-0 before:w-px before:bg-slate-200">
      {events.map((event) => (
        <article className="relative rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm" key={event.id}>
          <div className="absolute -left-[1.28rem] top-6 h-3.5 w-3.5 rounded-full border-4 border-amber-50 bg-slate-950" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getEventTone(event)}>{getEventLabel(event)}</Badge>
                <span className="text-sm text-slate-500">{new Date(event.occurredAt).toLocaleString("pt-BR")}</span>
              </div>
              <p className="text-sm font-medium text-slate-950">{event.actor ? `${event.actor.name} (${event.actor.email})` : "Autor nao informado"}</p>
              {event.descricao ? <p className="text-sm text-slate-700">{event.descricao}</p> : null}
            </div>
            {event.motivo ? <p className="max-w-lg text-sm text-slate-500">{event.motivo}</p> : null}
          </div>

          {(event.statusNovo || event.seiNumeroNovo || event.observacoes) ? (
            <div className="mt-4 grid gap-2 text-sm text-slate-600">
              {event.statusNovo ? (
                <p>
                  {event.statusAnterior ? `${event.statusAnterior} -> ${event.statusNovo}` : `Status atual: ${event.statusNovo}`}
                </p>
              ) : null}
              {event.seiNumeroNovo ? (
                <p>
                  {event.seiNumeroAnterior ? `${event.seiNumeroAnterior} -> ${event.seiNumeroNovo}` : `SEI ${event.seiNumeroNovo}`}
                </p>
              ) : null}
              {event.observacoes ? <p>{event.observacoes}</p> : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
