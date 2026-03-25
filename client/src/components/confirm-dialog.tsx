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
  onConfirm: (payload: { motivo: string; observacoes: string; extraOptionChecked: boolean }) => Promise<void> | void;
}) {
  const [motivo, setMotivo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [extraOptionChecked, setExtraOptionChecked] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setMotivo("");
      setObservacoes("");
      setExtraOptionChecked(false);
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  async function handleConfirm() {
    if (requireReason && !motivo.trim()) {
      setError("Informe o motivo desta alteracao.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onConfirm({ motivo: motivo.trim(), observacoes: observacoes.trim(), extraOptionChecked });
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
