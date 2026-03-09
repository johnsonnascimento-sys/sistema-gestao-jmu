import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { FormField } from "./form-field";
import { Textarea } from "./ui/textarea";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  requireReason,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  requireReason?: boolean;
  onConfirm: (payload: { motivo: string; observacoes: string }) => Promise<void> | void;
}) {
  const [motivo, setMotivo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setMotivo("");
      setObservacoes("");
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
      await onConfirm({ motivo: motivo.trim(), observacoes: observacoes.trim() });
      onOpenChange(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Falha ao executar a acao.");
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
