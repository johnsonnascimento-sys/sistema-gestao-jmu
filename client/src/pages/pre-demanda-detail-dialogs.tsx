import { FormEvent } from "react";
import { ConfirmDialog } from "../components/confirm-dialog";
import { FormField } from "../components/form-field";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import type { Andamento, PreDemanda, PreDemandaStatus, TarefaPendente, TarefaRecorrenciaTipo } from "../types";
import { selectClassName, TaskPrazoChangeState, WEEKDAY_OPTIONS } from "./pre-demanda-detail-types";
import { toIsoFromDateTimeLocal } from "./pre-demanda-detail-types";
import { getPreDemandaStatusLabel } from "../lib/pre-demanda-status";

// ── Shared action runner type ────────────────────────────────────────────────

type RunMutation = (action: () => Promise<void>, successMessage: string) => Promise<void>;

// ── AndamentoDialogs ─────────────────────────────────────────────────────────

export function AndamentoCreateDialog({
  open,
  onClose,
  form,
  onFormChange,
  isSubmitting,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  form: { descricao: string; data_hora: string };
  onFormChange: (form: { descricao: string; data_hora: string }) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar andamento manual</DialogTitle>
          <DialogDescription>Inclua uma movimentacao livre no historico do processo.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField label="Data e hora">
            <Input
              onChange={(e) => onFormChange({ ...form, data_hora: e.target.value })}
              type="datetime-local"
              value={form.data_hora}
            />
          </FormField>
          <FormField label="Descricao">
            <Textarea
              onChange={(e) => onFormChange({ ...form, descricao: e.target.value })}
              rows={6}
              value={form.descricao}
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="ghost">Cancelar</Button>
          <Button disabled={form.descricao.trim().length < 3 || isSubmitting} onClick={onSubmit} type="button">
            Lancar andamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AndamentoEditDialog({
  editingAndamento,
  onClose,
  form,
  onFormChange,
  isSubmitting,
  onSubmit,
}: {
  editingAndamento: Andamento | null;
  onClose: () => void;
  form: { descricao: string; data_hora: string };
  onFormChange: (form: { descricao: string; data_hora: string }) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={Boolean(editingAndamento)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar andamento manual</DialogTitle>
          <DialogDescription>Ajuste o texto e a data/hora do andamento manual.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField label="Data e hora">
            <Input
              onChange={(e) => onFormChange({ ...form, data_hora: e.target.value })}
              type="datetime-local"
              value={form.data_hora}
            />
          </FormField>
          <FormField label="Descricao">
            <Textarea
              onChange={(e) => onFormChange({ ...form, descricao: e.target.value })}
              rows={6}
              value={form.descricao}
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="ghost">Cancelar</Button>
          <Button
            disabled={!editingAndamento || form.descricao.trim().length < 3 || isSubmitting}
            onClick={onSubmit}
            type="button"
          >
            Salvar alteracoes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AndamentoDeleteDialog({
  deleteAndamento,
  onClose,
  confirm,
  onConfirmChange,
  isSubmitting,
  onSubmit,
}: {
  deleteAndamento: Andamento | null;
  onClose: () => void;
  confirm: string;
  onConfirmChange: (v: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={Boolean(deleteAndamento)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir andamento manual</DialogTitle>
          <DialogDescription>Esta acao remove o andamento manual e regista a remocao no historico. Digite EXCLUIR para confirmar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {deleteAndamento?.descricao}
          </div>
          <FormField label="Confirmacao">
            <Input onChange={(e) => onConfirmChange(e.target.value)} placeholder="EXCLUIR" value={confirm} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="ghost">Cancelar</Button>
          <Button
            disabled={!deleteAndamento || confirm !== "EXCLUIR" || isSubmitting}
            onClick={onSubmit}
            type="button"
            variant="primary"
          >
            Excluir andamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── TarefaDialogs ────────────────────────────────────────────────────────────

type EditTaskForm = {
  descricao: string;
  tipo: "fixa" | "livre";
  prazo_conclusao: string;
  recorrencia_tipo: "" | TarefaRecorrenciaTipo;
  recorrencia_dias_semana: string[];
  recorrencia_dia_mes: string;
};

export function TarefaEditDialog({
  editingTask,
  onClose,
  form,
  onFormChange,
  isSubmitting,
  onSubmit,
  prazoMax,
}: {
  editingTask: TarefaPendente | null;
  onClose: () => void;
  form: EditTaskForm;
  onFormChange: (form: EditTaskForm) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
  prazoMax?: string;
}) {
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={Boolean(editingTask)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar tarefa</DialogTitle>
          <DialogDescription>Ajuste a descriçao e o tipo da próxima tarefa.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField label="Descriçao">
            <Textarea
              onChange={(e) => onFormChange({ ...form, descricao: e.target.value })}
              rows={5}
              value={form.descricao}
            />
          </FormField>
          <FormField label="Tipo">
            <select
              className={selectClassName}
              onChange={(e) => onFormChange({ ...form, tipo: e.target.value as "fixa" | "livre" })}
              value={form.tipo}
            >
              <option value="livre">Livre</option>
              <option value="fixa">Fixa</option>
            </select>
          </FormField>
          <FormField label="Prazo de conclusao">
            <Input
              max={prazoMax}
              onChange={(e) => onFormChange({ ...form, prazo_conclusao: e.target.value })}
              type="date"
              value={form.prazo_conclusao}
            />
          </FormField>
          <FormField label="Recorrencia">
            <select
              className={selectClassName}
              onChange={(e) => {
                const v = e.target.value as "" | TarefaRecorrenciaTipo;
                onFormChange({
                  ...form,
                  recorrencia_tipo: v,
                  recorrencia_dias_semana: v === "semanal" ? form.recorrencia_dias_semana : [],
                  recorrencia_dia_mes: v === "mensal" ? form.recorrencia_dia_mes : "",
                });
              }}
              value={form.recorrencia_tipo}
            >
              <option value="">Sem recorrencia</option>
              <option value="diaria">Diaria</option>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
            </select>
          </FormField>
          {form.recorrencia_tipo === "semanal" ? (
            <div className="col-span-2 flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((item) => (
                <Button
                  key={`edit-${item}`}
                  onClick={() =>
                    onFormChange({
                      ...form,
                      recorrencia_dias_semana: form.recorrencia_dias_semana.includes(item)
                        ? form.recorrencia_dias_semana.filter((v) => v !== item)
                        : [...form.recorrencia_dias_semana, item],
                    })
                  }
                  size="sm"
                  type="button"
                  variant={form.recorrencia_dias_semana.includes(item) ? "primary" : "outline"}
                >
                  {item}
                </Button>
              ))}
            </div>
          ) : null}
          {form.recorrencia_tipo === "mensal" ? (
            <FormField label="Dia do mes">
              <Input
                max="31"
                min="1"
                onChange={(e) => onFormChange({ ...form, recorrencia_dia_mes: e.target.value })}
                type="number"
                value={form.recorrencia_dia_mes}
              />
            </FormField>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="ghost">Cancelar</Button>
          <Button
            disabled={!editingTask || form.descricao.trim().length < 3 || isSubmitting || !form.prazo_conclusao}
            onClick={onSubmit}
            type="button"
          >
            Salvar alteraçoes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TarefaDeleteDialog({
  deleteTask,
  onClose,
  confirm,
  onConfirmChange,
  isSubmitting,
  onSubmit,
}: {
  deleteTask: TarefaPendente | null;
  onClose: () => void;
  confirm: string;
  onConfirmChange: (v: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={Boolean(deleteTask)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir tarefa</DialogTitle>
          <DialogDescription>Esta ação remove a tarefa pendente e registra a remoção no histórico. Digite EXCLUIR para confirmar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {deleteTask?.descricao}
          </div>
          <FormField label="Confirmação">
            <Input onChange={(e) => onConfirmChange(e.target.value)} placeholder="EXCLUIR" value={confirm} />
          </FormField>
        </div>
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="ghost">Cancelar</Button>
          <Button
            disabled={!deleteTask || confirm !== "EXCLUIR" || isSubmitting}
            onClick={onSubmit}
            type="button"
            variant="primary"
          >
            Excluir tarefa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TarefaPrazoChangeDialog({
  taskPrazoChange,
  onClose,
  isSubmitting,
  onConfirm,
}: {
  taskPrazoChange: TaskPrazoChangeState | null;
  onClose: () => void;
  isSubmitting: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={Boolean(taskPrazoChange)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar alteracao de prazo do processo</DialogTitle>
          <DialogDescription>
            {taskPrazoChange?.details.prazoLabel ?? "Este prazo"} ja possui uma data gravada neste processo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Data anterior:{" "}
            {taskPrazoChange?.details.prazoDataAnterior
              ? new Date(taskPrazoChange.details.prazoDataAnterior).toLocaleDateString("pt-BR")
              : "-"}
          </div>
          <div className="rounded-[20px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Nova data:{" "}
            {taskPrazoChange?.details.prazoDataNova
              ? new Date(taskPrazoChange.details.prazoDataNova).toLocaleDateString("pt-BR")
              : "-"}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="ghost">Cancelar</Button>
          <Button disabled={isSubmitting} onClick={onConfirm} type="button">
            Confirmar alteracao
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


