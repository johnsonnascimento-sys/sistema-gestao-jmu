import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { FormField } from "./form-field";
import { Textarea } from "./ui/textarea";
import { formatAppError } from "../lib/api";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  requireReason,
  extraOption,
  reopenScheduleOption,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  requireReason?: boolean;
  extraOption?: {
    label: string;
    description?: string;
  };
  reopenScheduleOption?: boolean;
  onConfirm: (payload: {
    motivo: string;
    observacoes: string;
    extraOptionChecked: boolean;
    reopenSchedule: { mode: "days" | "date"; days?: number; date?: string } | null;
  }) => Promise<void> | void;
}) {
  const [motivo, setMotivo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [extraOptionChecked, setExtraOptionChecked] = useState(false);
  const [scheduleReopen, setScheduleReopen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"days" | "date">("days");
  const [scheduleDays, setScheduleDays] = useState("7");
  const [scheduleDate, setScheduleDate] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setMotivo("");
      setObservacoes("");
      setExtraOptionChecked(false);
      setScheduleReopen(false);
      setScheduleMode("days");
      setScheduleDays("7");
      setScheduleDate("");
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  async function handleConfirm() {
    if (requireReason && !motivo.trim()) {
      setError("Informe o motivo desta alteracao.");
      return;
    }

    if (scheduleReopen) {
      if (scheduleMode === "days" && (!scheduleDays.trim() || Number(scheduleDays) <= 0)) {
        setError("Informe em quantos dias o processo deve ser reaberto.");
        return;
      }
      if (scheduleMode === "date" && !scheduleDate) {
        setError("Informe a data da reabertura programada.");
        return;
      }
    }

    setSubmitting(true);
    setError("");

    try {
      await onConfirm({
        motivo: motivo.trim(),
        observacoes: observacoes.trim(),
        extraOptionChecked,
        reopenSchedule: scheduleReopen
          ? scheduleMode === "days"
            ? { mode: "days", days: Number(scheduleDays) }
            : { mode: "date", date: scheduleDate }
          : null,
      });
      onOpenChange(false);
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao executar a acao."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <FormField hint="Obrigatorio para encerramento e reabertura." label="Motivo">
            <Textarea onChange={(event) => setMotivo(event.target.value)} placeholder="Descreva a razao operacional." rows={3} value={motivo} />
          </FormField>

          <FormField hint="Opcional." label="Observacoes">
            <Textarea onChange={(event) => setObservacoes(event.target.value)} placeholder="Adicione contexto adicional." rows={3} value={observacoes} />
          </FormField>

          {extraOption ? (
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
              <input
                checked={extraOptionChecked}
                className="mt-1 h-4 w-4 shrink-0 accent-slate-950"
                onChange={(event) => setExtraOptionChecked(event.target.checked)}
                type="checkbox"
              />
              <span className="grid gap-1">
                <span className="font-medium text-slate-950">{extraOption.label}</span>
                {extraOption.description ? <span className="text-slate-500">{extraOption.description}</span> : null}
              </span>
            </label>
          ) : null}

          {reopenScheduleOption ? (
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
              <label className="flex items-center gap-3">
                <input checked={!scheduleReopen} className="h-4 w-4 accent-slate-950" onChange={() => setScheduleReopen(false)} type="radio" />
                <span>Somente concluir</span>
              </label>
              <label className="flex items-center gap-3">
                <input checked={scheduleReopen} className="h-4 w-4 accent-slate-950" onChange={() => setScheduleReopen(true)} type="radio" />
                <span>Concluir e agendar reabertura</span>
              </label>
              {scheduleReopen ? (
                <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Reabertura programada</span>
                  <label className="flex items-center gap-3">
                    <input checked={scheduleMode === "date"} className="h-4 w-4 accent-slate-950" onChange={() => setScheduleMode("date")} type="radio" />
                    <span>Data certa</span>
                  </label>
                  {scheduleMode === "date" ? <input className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" onChange={(event) => setScheduleDate(event.target.value)} type="date" value={scheduleDate} /> : null}
                  <label className="flex items-center gap-3">
                    <input checked={scheduleMode === "days"} className="h-4 w-4 accent-slate-950" onChange={() => setScheduleMode("days")} type="radio" />
                    <span>Prazo em dias</span>
                  </label>
                  {scheduleMode === "days" ? (
                    <input
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                      min="1"
                      onChange={(event) => setScheduleDays(event.target.value)}
                      type="number"
                      value={scheduleDays}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
            Cancelar
          </Button>
          <Button disabled={submitting} onClick={handleConfirm} type="button" variant="primary">
            {submitting ? "Aguarde..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
