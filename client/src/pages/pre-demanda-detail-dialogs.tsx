import { ChevronDown, ChevronUp } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Reorder } from "framer-motion";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { deadlineSignalLabel, deadlineSignalTone } from "../lib/deadline-signal";
import { formatDateOnlyPtBr } from "../lib/date";
import type {
  Andamento,
  PreDemanda,
  PreDemandaStatus,
  Setor,
  TaskScheduleSuggestion,
  TarefaPendente,
  TarefaRecorrenciaTipo,
} from "../types";
import { selectClassName, TaskPrazoChangeState, WEEKDAY_OPTIONS } from "./pre-demanda-detail-types";
import { formatRecorrenciaLabel, getTaskSignal, toIsoFromDateTimeLocal } from "./pre-demanda-detail-types";
import { getPreDemandaStatusLabel } from "../lib/pre-demanda-status";

// ── Shared action runner type ────────────────────────────────────────────────

type RunMutation = (action: () => Promise<void>, successMessage: string) => Promise<void>;

function formatTaskTimeLabel(task: Pick<TarefaPendente, "horarioInicio" | "horarioFim">) {
  if (task.horarioInicio && task.horarioFim) {
    return `${task.horarioInicio} - ${task.horarioFim}`;
  }

  if (task.horarioInicio) {
    return `Inicio ${task.horarioInicio}`;
  }

  if (task.horarioFim) {
    return `Termino ${task.horarioFim}`;
  }

  return null;
}

function formatTaskSuggestionDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

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
  urgente: boolean;
  prazo_conclusao: string;
  horario_inicio: string;
  horario_fim: string;
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
          <label className="flex items-center justify-between rounded-[20px] border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm text-slate-700">
            <div className="pr-4">
              <span className="block font-semibold text-slate-950">Marcar tarefa como urgente</span>
              <span className="text-xs text-slate-600">Com a tarefa urgente, o processo tambem fica urgente.</span>
            </div>
            <input
              checked={form.urgente}
              className="h-5 w-5 accent-rose-600"
              onChange={(e) => onFormChange({ ...form, urgente: e.target.checked })}
              type="checkbox"
            />
          </label>
          <FormField label="Prazo de conclusao">
            <Input
              max={prazoMax}
              onChange={(e) => onFormChange({ ...form, prazo_conclusao: e.target.value })}
              type="date"
              value={form.prazo_conclusao}
            />
          </FormField>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField hint="Opcional." label="Horario de inicio">
              <Input
                onChange={(e) => onFormChange({ ...form, horario_inicio: e.target.value })}
                type="time"
                value={form.horario_inicio}
              />
            </FormField>
            <FormField hint="Opcional." label="Horario de termino">
              <Input
                onChange={(e) => onFormChange({ ...form, horario_fim: e.target.value })}
                type="time"
                value={form.horario_fim}
              />
            </FormField>
          </div>
          <FormField label="Recorrencia">
            <select
              className={selectClassName}
              onChange={(e) => {
                const v = e.target.value as "" | TarefaRecorrenciaTipo;
                onFormChange({
                  ...form,
                  recorrencia_tipo: v,
                  recorrencia_dias_semana: v === "semanal" ? form.recorrencia_dias_semana : [],
                  recorrencia_dia_mes: ["mensal", "trimestral", "quadrimestral", "semestral", "anual"].includes(v) ? form.recorrencia_dia_mes : "",
                });
              }}
              value={form.recorrencia_tipo}
            >
              <option value="">Sem recorrencia</option>
              <option value="diaria">Diaria</option>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
              <option value="trimestral">Trimestral</option>
              <option value="quadrimestral">Quadrimestral</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
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
          {["mensal", "trimestral", "quadrimestral", "semestral", "anual"].includes(form.recorrencia_tipo) ? (
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

type TaskCreateForm = {
  descricao: string;
  tipo: "fixa" | "livre";
  urgente: boolean;
  prazo_conclusao: string;
  horario_inicio: string;
  horario_fim: string;
  recorrencia_tipo: "" | TarefaRecorrenciaTipo;
  recorrencia_dias_semana: string[];
  recorrencia_dia_mes: string;
  setor_destino_id: string;
  assinatura_interessado_id: string;
};

type TaskDialogTab = "nova" | "pendentes" | "concluidas" | "analitico";

type TaskEditorForm = EditTaskForm & {
  setor_destino_id?: string;
  assinatura_interessado_id?: string;
};

function TaskSection({
  title,
  description,
  open,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-slate-50/80">
      <button
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
        onClick={onToggle}
        type="button"
      >
        <div>
          <p className='text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500'>{title}</p>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <span className="mt-1 rounded-full border border-slate-200 bg-white p-2 text-slate-500">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open ? <div className="grid gap-4 border-t border-slate-200 px-4 py-4">{children}</div> : null}
    </section>
  );
}

function TaskComposer({
  mode,
  form,
  onFormChange,
  prazoMax,
  taskSuggestions,
  taskSuggestionsLoading,
  onApplyTaskSuggestion,
  taskShortcutOptions,
  requiresTaskSetorDestino,
  requiresTaskSignaturePerson,
  setores,
  interessados,
  interessadosLoading,
  signatureExpanded,
  onSignatureExpandedChange,
  signatureSearch,
  onSignatureSearchChange,
  signatureSearchResults,
  signatureSelectedName,
  agendaOpen,
  onAgendaOpenChange,
  advancedOpen,
  onAdvancedOpenChange,
}: {
  mode: "create" | "edit";
  form: TaskEditorForm;
  onFormChange: (form: TaskEditorForm) => void;
  prazoMax?: string;
  taskSuggestions: TaskScheduleSuggestion[];
  taskSuggestionsLoading: boolean;
  onApplyTaskSuggestion: (suggestion: TaskScheduleSuggestion) => void;
  taskShortcutOptions: string[];
  requiresTaskSetorDestino: boolean;
  requiresTaskSignaturePerson: boolean;
  setores: Setor[];
  interessados: PreDemanda["interessados"];
  interessadosLoading: boolean;
  signatureExpanded: boolean;
  onSignatureExpandedChange: (expanded: boolean) => void;
  signatureSearch: string;
  onSignatureSearchChange: (value: string) => void;
  signatureSearchResults: PreDemanda["interessados"][number]["interessado"][];
  signatureSelectedName: string;
  agendaOpen: boolean;
  onAgendaOpenChange: (value: boolean) => void;
  advancedOpen: boolean;
  onAdvancedOpenChange: (value: boolean) => void;
}) {
  const supportsAdvancedRouting = mode === "create";
  const showTaskShortcuts = mode === "create" && taskShortcutOptions.length > 0;

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(220px,0.8fr)]">
          <FormField label="Descricao">
            <Textarea
              onChange={(event) =>
                onFormChange({
                  ...form,
                  descricao: event.target.value,
                })
              }
              rows={4}
              value={form.descricao}
            />
          </FormField>
          <div className="grid gap-3">
            <FormField label="Tipo">
              <select
                className={selectClassName}
                onChange={(event) =>
                  onFormChange({
                    ...form,
                    tipo: event.target.value as "fixa" | "livre",
                  })
                }
                value={form.tipo}
              >
                <option value="livre">Livre</option>
                <option value="fixa">Fixa</option>
              </select>
            </FormField>
            <FormField
              hint="Nao pode passar do prazo final do processo."
              label="Prazo da tarefa"
            >
              <Input
                max={prazoMax}
                onChange={(event) =>
                  onFormChange({
                    ...form,
                    prazo_conclusao: event.target.value,
                  })
                }
                type="date"
                value={form.prazo_conclusao}
              />
            </FormField>
          </div>
        </div>
        <label className="flex items-center justify-between gap-4 rounded-[20px] border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm text-slate-700">
          <div className="pr-4">
            <span className="block font-semibold text-slate-950">Marcar tarefa como urgente</span>
            <span className="text-xs text-slate-600">Com a tarefa urgente, o processo tambem fica urgente.</span>
          </div>
          <input
            checked={form.urgente}
            className="h-5 w-5 shrink-0 accent-rose-600"
            onChange={(event) =>
              onFormChange({
                ...form,
                urgente: event.target.checked,
              })
            }
            type="checkbox"
          />
        </label>
      </section>

      <TaskSection
        description="Horarios e sugestoes de agenda. So abra quando precisar detalhar a execucao."
        onToggle={() => onAgendaOpenChange(!agendaOpen)}
        open={agendaOpen}
        title="Agenda"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <FormField hint="Opcional." label="Horario de inicio">
            <Input
              onChange={(event) =>
                onFormChange({
                  ...form,
                  horario_inicio: event.target.value,
                })
              }
              type="time"
              value={form.horario_inicio}
            />
          </FormField>
          <FormField hint="Opcional." label="Horario de termino">
            <Input
              onChange={(event) =>
                onFormChange({
                  ...form,
                  horario_fim: event.target.value,
                })
              }
              type="time"
              value={form.horario_fim}
            />
          </FormField>
        </div>
        <div className="grid gap-2 rounded-[20px] border border-amber-200 bg-amber-50/70 p-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-800">Sugestoes de agenda</p>
            <p className="text-xs text-amber-900/80">Dias e horarios com menor carga de tarefas pendentes.</p>
          </div>
          {taskSuggestionsLoading ? (
            <p className="text-xs text-slate-500">Calculando agenda mais livre...</p>
          ) : taskSuggestions.length === 0 ? (
            <p className="text-xs text-slate-500">Nao ha sugestoes disponiveis para a janela atual do processo.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {taskSuggestions.map((suggestion) => (
                <button
                  className="rounded-2xl border border-amber-200 bg-white px-4 py-3 text-left transition hover:border-amber-300 hover:bg-amber-50"
                  key={`${suggestion.data}-${suggestion.horarioInicio}`}
                  onClick={() => onApplyTaskSuggestion(suggestion)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-950">{formatTaskSuggestionDate(suggestion.data)}</span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-900">
                      {suggestion.horarioInicio} - {suggestion.horarioFim}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {suggestion.scopedToDate ? "Melhor faixa encontrada para o dia selecionado." : "Combinacao sugerida pelo volume atual."}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Dia com {suggestion.totalTarefasNoDia} tarefa(s) pendente(s) e faixa com {suggestion.totalTarefasNaFaixa}.
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </TaskSection>

      <TaskSection
        description="Recorrencia, setor, assinatura e atalhos. Fica recolhido para nao poluir o fluxo principal."
        onToggle={() => onAdvancedOpenChange(!advancedOpen)}
        open={advancedOpen}
        title="Avancado"
      >
        <div className="grid gap-3 rounded-[20px] border border-slate-200 bg-white p-4">
          <FormField
            hint="Escolha apenas se a tarefa precisar voltar a ser criada depois da conclusao."
            label="Recorrencia"
          >
            <select
              className={selectClassName}
              onChange={(event) =>
                onFormChange({
                  ...form,
                  recorrencia_tipo: event.target.value as "" | TarefaRecorrenciaTipo,
                  recorrencia_dias_semana: event.target.value === "semanal" ? form.recorrencia_dias_semana : [],
                  recorrencia_dia_mes: ["mensal", "trimestral", "quadrimestral", "semestral", "anual"].includes(event.target.value)
                    ? form.recorrencia_dia_mes
                    : "",
                })
              }
              value={form.recorrencia_tipo}
            >
              <option value="">Sem repeticao</option>
              <option value="diaria">Diaria</option>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
              <option value="trimestral">Trimestral</option>
              <option value="quadrimestral">Quadrimestral</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
            </select>
          </FormField>

          {form.recorrencia_tipo ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
              Essa recorrencia continua ate {formatDateOnlyPtBr(prazoMax, "o prazo do processo")}. Depois dessa data, o sistema nao cria novas tarefas.
            </div>
          ) : null}

          {form.recorrencia_tipo === "semanal" ? (
            <div className="grid gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Dias da semana</p>
                <p className="text-xs text-slate-500">Escolha em quais dias a proxima tarefa deve reaparecer.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((item) => (
                  <Button
                    key={`${mode}-${item}`}
                    onClick={() =>
                      onFormChange({
                        ...form,
                        recorrencia_dias_semana: form.recorrencia_dias_semana.includes(item)
                          ? form.recorrencia_dias_semana.filter((value) => value !== item)
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
            </div>
          ) : null}

          {["mensal", "trimestral", "quadrimestral", "semestral", "anual"].includes(form.recorrencia_tipo) ? (
            <FormField hint="A tarefa sera repetida nesse mesmo dia conforme a periodicidade escolhida." label="Dia do mes">
              <Input
                max="31"
                min="1"
                onChange={(event) =>
                  onFormChange({
                    ...form,
                    recorrencia_dia_mes: event.target.value,
                  })
                }
                type="number"
                value={form.recorrencia_dia_mes}
              />
            </FormField>
          ) : form.recorrencia_tipo === "diaria" ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              A recorrencia diaria nao precisa de dia da semana nem dia do mes.
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Sem repeticao. A tarefa termina no prazo escolhido.
            </div>
          )}
        </div>

        {supportsAdvancedRouting && requiresTaskSetorDestino ? (
          <div className="grid gap-3 rounded-[20px] border border-blue-200 bg-blue-50/70 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-800">Setor destino obrigatorio</p>
            <select
              className="min-w-0 h-11 rounded-full border border-blue-200 bg-white px-4 text-sm"
              onChange={(event) =>
                onFormChange({
                  ...form,
                  setor_destino_id: event.target.value,
                })
              }
              value={form.setor_destino_id ?? ""}
            >
              <option value="">Escolha o setor destino</option>
              {setores.map((setor) => (
                <option key={setor.id} value={setor.id}>
                  {setor.sigla} - {setor.nomeCompleto}
                </option>
              ))}
            </select>
            <p className="text-xs text-blue-900/80">Ao concluir, o processo sera tramitado automaticamente para o setor escolhido.</p>
          </div>
        ) : null}

        {supportsAdvancedRouting && requiresTaskSignaturePerson ? (
          <div className="grid gap-3 rounded-[20px] border border-indigo-200 bg-indigo-50/70 p-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-indigo-800">Assinatura obrigatoria</p>
              <p className="text-xs text-indigo-900/80">Selecione a pessoa vinculada ou pesquise outra pessoa cadastrada.</p>
            </div>
            {interessadosLoading ? (
              <p className="text-xs text-slate-500">Carregando pessoas vinculadas...</p>
            ) : interessados.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhuma pessoa vinculada a este processo.</p>
            ) : (
              <div className="grid gap-2">
                {interessados.map((item) => (
                  <button
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                      form.assinatura_interessado_id === item.interessado.id
                        ? "border-indigo-300 bg-indigo-100 text-indigo-900"
                        : "border-indigo-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/50"
                    }`}
                    key={item.interessado.id}
                    onClick={() =>
                      onFormChange({
                        ...form,
                        assinatura_interessado_id: item.interessado.id,
                      })
                    }
                    type="button"
                  >
                    <span className="font-medium">
                      {item.interessado.nome}
                      {item.interessado.cargo ? <span className="ml-1 text-xs font-normal text-slate-500">- {item.interessado.cargo}</span> : null}
                    </span>
                    {form.assinatura_interessado_id === item.interessado.id ? <span className="text-xs font-semibold text-indigo-700">Selecionado</span> : null}
                  </button>
                ))}
              </div>
            )}
            <button
              className="w-fit text-xs font-semibold text-indigo-700 transition-colors hover:text-indigo-900"
              onClick={() => onSignatureExpandedChange(!signatureExpanded)}
              type="button"
            >
              {signatureExpanded ? "Recolher busca" : "Buscar outra pessoa cadastrada"}
            </button>
            {signatureExpanded ? (
              <div className="grid gap-2">
                <input
                  className="h-10 rounded-full border border-slate-200 bg-white px-4 text-sm"
                  onChange={(event) => onSignatureSearchChange(event.target.value)}
                  placeholder="Buscar por nome..."
                  value={signatureSearch}
                />
                {signatureSearch.trim().length >= 2 && signatureSearchResults.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhuma pessoa encontrada.</p>
                ) : null}
                {signatureSearchResults.map((item) => (
                  <button
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                      form.assinatura_interessado_id === item.id
                        ? "border-indigo-300 bg-indigo-100 text-indigo-900"
                        : "border-slate-200 bg-white hover:border-indigo-200"
                    }`}
                    key={item.id}
                    onClick={() =>
                      onFormChange({
                        ...form,
                        assinatura_interessado_id: item.id,
                      })
                    }
                    type="button"
                  >
                    <span className="font-medium">
                      {item.nome}
                      {item.cargo ? <span className="ml-1 text-xs font-normal text-slate-500">- {item.cargo}</span> : null}
                    </span>
                    {form.assinatura_interessado_id === item.id ? <span className="text-xs font-semibold text-indigo-700">Selecionado</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-slate-500">
              A tarefa sera nomeada automaticamente com o nome da pessoa selecionada.
              {signatureSelectedName ? ` Selecionada: ${signatureSelectedName}.` : ""}
            </p>
          </div>
        ) : null}

        {showTaskShortcuts ? (
          <div className="grid gap-3 rounded-[20px] border border-slate-200 bg-white p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <select
                className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm"
                onChange={(event) =>
                  onFormChange({
                    ...form,
                    descricao: event.target.value,
                    tipo: "fixa",
                    setor_destino_id:
                      event.target.value === "Envio para" || event.target.value === "Retorno do setor"
                        ? form.setor_destino_id
                        : "",
                    assinatura_interessado_id: "",
                  })
                }
                value=""
              >
                <option value="">Atalhos de tarefas</option>
                {taskShortcutOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 md:self-center">Os atalhos consideram envolvidos e aceleram o preenchimento.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {taskShortcutOptions.slice(0, 6).map((item) => (
                <Button
                  key={item}
                  onClick={() =>
                    onFormChange({
                      ...form,
                      descricao: item,
                      tipo: "fixa",
                      setor_destino_id:
                        item === "Envio para" || item === "Retorno do setor" ? form.setor_destino_id : "",
                      assinatura_interessado_id: "",
                    })
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {item}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </TaskSection>
    </div>
  );
}

export function TarefasDialog({
  open,
  onClose,
  record,
  interessados,
  interessadosLoading,
  setores,
  taskForm,
  onTaskFormChange,
  taskShortcutOptions,
  requiresTaskSetorDestino,
  requiresTaskSignaturePerson,
  signatureExpanded,
  onSignatureExpandedChange,
  signatureSearch,
  onSignatureSearchChange,
  signatureSearchResults,
  signatureSelectedName,
  pendingTasks,
  completedTasks,
  taskSuggestions,
  taskSuggestionsLoading,
  isSubmitting,
  onApplyTaskSuggestion,
  onCreateTask,
  onCompleteTask,
  onEditTask,
  editingTask,
  editTaskForm,
  onEditTaskFormChange,
  onCancelEdit,
  onSaveTask,
  onDeleteTask,
  onReorderTasks,
}: {
  open: boolean;
  onClose: () => void;
  record: PreDemanda;
  interessados: PreDemanda["interessados"];
  interessadosLoading: boolean;
  setores: Setor[];
  taskForm: TaskCreateForm;
  onTaskFormChange: (form: TaskCreateForm) => void;
  taskShortcutOptions: string[];
  requiresTaskSetorDestino: boolean;
  requiresTaskSignaturePerson: boolean;
  signatureExpanded: boolean;
  onSignatureExpandedChange: (expanded: boolean) => void;
  signatureSearch: string;
  onSignatureSearchChange: (value: string) => void;
  signatureSearchResults: PreDemanda["interessados"][number]["interessado"][];
  signatureSelectedName: string;
  pendingTasks: TarefaPendente[];
  completedTasks: TarefaPendente[];
  taskSuggestions: TaskScheduleSuggestion[];
  taskSuggestionsLoading: boolean;
  isSubmitting: boolean;
  onApplyTaskSuggestion: (suggestion: TaskScheduleSuggestion) => void;
  onCreateTask: () => void;
  onCompleteTask: (task: TarefaPendente) => void;
  onEditTask: (task: TarefaPendente) => void;
  editingTask: TarefaPendente | null;
  editTaskForm: EditTaskForm;
  onEditTaskFormChange: (form: EditTaskForm) => void;
  onCancelEdit: () => void;
  onSaveTask: () => void;
  onDeleteTask: (task: TarefaPendente) => void;
  onReorderTasks: (tasks: TarefaPendente[]) => void;
}) {
  const [activeTab, setActiveTab] = useState<TaskDialogTab>("pendentes");
  const [createAgendaOpen, setCreateAgendaOpen] = useState(false);
  const [createAdvancedOpen, setCreateAdvancedOpen] = useState(false);
  const [editAgendaOpen, setEditAgendaOpen] = useState(false);
  const [editAdvancedOpen, setEditAdvancedOpen] = useState(false);
  const urgentPendingCount = pendingTasks.filter((task) => task.urgente).length;
  const selectedTab = editingTask ? "nova" : activeTab;
  const activeComposerForm = editingTask ? (editTaskForm as TaskEditorForm) : taskForm;
  const saveDisabled = editingTask
    ? !editingTask || activeComposerForm.descricao.trim().length < 3 || isSubmitting || !activeComposerForm.prazo_conclusao
    : activeComposerForm.descricao.trim().length < 3 ||
      !activeComposerForm.prazo_conclusao ||
      (requiresTaskSetorDestino && !activeComposerForm.setor_destino_id) ||
      (requiresTaskSignaturePerson && !activeComposerForm.assinatura_interessado_id) ||
      isSubmitting;

  useEffect(() => {
    if (!open) {
      return;
    }

    if (editingTask) {
      setActiveTab("nova");
      setEditAdvancedOpen(Boolean(editTaskForm.recorrencia_tipo));
      return;
    }

    setActiveTab(pendingTasks.length > 0 ? "pendentes" : "nova");
  }, [open, editingTask, editTaskForm.recorrencia_tipo, pendingTasks.length]);

  useEffect(() => {
    if (!open || editingTask) {
      return;
    }

    setCreateAdvancedOpen(
      Boolean(
        taskForm.recorrencia_tipo ||
          requiresTaskSetorDestino ||
          requiresTaskSignaturePerson,
      ),
    );
  }, [
    open,
    editingTask,
    taskForm.recorrencia_tipo,
    requiresTaskSetorDestino,
    requiresTaskSignaturePerson,
  ]);

  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader>
          <div className="border-b border-slate-200 px-6 pb-5 pt-6">
            <DialogTitle>Tarefas do processo</DialogTitle>
            <DialogDescription>
              Gestao centralizada das tarefas. A pagina do processo mostra apenas o resumo operacional.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-6">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Painel de tarefas</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {editingTask
                      ? "Edite a tarefa selecionada sem sair do fluxo principal."
                      : "Use as abas para separar criacao, operacao e consulta analitica."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">{pendingTasks.length} pendente(s)</span>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-800">{completedTasks.length} concluida(s)</span>
                  {urgentPendingCount > 0 ? <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold text-rose-800">{urgentPendingCount} urgente(s)</span> : null}
                </div>
              </div>
            </div>

            <Tabs onValueChange={(value) => setActiveTab(value as TaskDialogTab)} value={selectedTab}>
              <TabsList className="h-auto flex-wrap gap-2 rounded-[22px] bg-slate-100/90 p-2">
                <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
                <TabsTrigger value="nova">{editingTask ? "Editar tarefa" : "Nova tarefa"}</TabsTrigger>
                <TabsTrigger value="concluidas">Concluidas</TabsTrigger>
                <TabsTrigger value="analitico">Analitico</TabsTrigger>
              </TabsList>
              <TabsContent className="mt-0" value="nova">
                <TaskComposer
                  agendaOpen={editingTask ? editAgendaOpen : createAgendaOpen}
                  advancedOpen={editingTask ? editAdvancedOpen : createAdvancedOpen}
                  form={activeComposerForm}
                  interessados={interessados}
                  interessadosLoading={interessadosLoading}
                  mode={editingTask ? "edit" : "create"}
                  onAgendaOpenChange={editingTask ? setEditAgendaOpen : setCreateAgendaOpen}
                  onAdvancedOpenChange={editingTask ? setEditAdvancedOpen : setCreateAdvancedOpen}
                  onApplyTaskSuggestion={onApplyTaskSuggestion}
                  onFormChange={(form) => editingTask ? onEditTaskFormChange(form as EditTaskForm) : onTaskFormChange(form as TaskCreateForm)}
                  onSignatureExpandedChange={onSignatureExpandedChange}
                  onSignatureSearchChange={onSignatureSearchChange}
                  prazoMax={record.prazoProcesso ?? undefined}
                  requiresTaskSetorDestino={!editingTask && requiresTaskSetorDestino}
                  requiresTaskSignaturePerson={!editingTask && requiresTaskSignaturePerson}
                  setores={setores}
                  signatureExpanded={signatureExpanded}
                  signatureSearch={signatureSearch}
                  signatureSearchResults={signatureSearchResults}
                  signatureSelectedName={signatureSelectedName}
                  taskShortcutOptions={editingTask ? [] : taskShortcutOptions}
                  taskSuggestions={taskSuggestions}
                  taskSuggestionsLoading={taskSuggestionsLoading}
                />
              </TabsContent>

              <TabsContent className="mt-0" value="pendentes">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-950">Checklist em cards</p>
                      <span className="text-xs text-slate-500">{pendingTasks.length} pendente(s)</span>
                    </div>
                    {pendingTasks.length === 0 ? (
                      <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Nenhuma tarefa pendente.</p>
                    ) : (
                      <Reorder.Group axis="y" className="grid gap-3" onReorder={onReorderTasks} values={pendingTasks}>
                        {pendingTasks.map((task) => (
                          <Reorder.Item key={task.id} value={task}>
                            <div className="cursor-grab rounded-[24px] border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md active:cursor-grabbing">
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="flex min-w-0 gap-3">
                                  <input className="mt-1 h-4 w-4 shrink-0 accent-slate-950" onChange={() => onCompleteTask(task)} type="checkbox" />
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-950">{task.descricao}</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700">{task.tipo}</span>
                                      {task.urgente ? <span className="inline-flex rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">Urgente</span> : null}
                                      {formatRecorrenciaLabel(task) ? <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-sky-800 ring-1 ring-sky-200">{formatRecorrenciaLabel(task)}</span> : null}
                                      {(() => { const signal = getTaskSignal(task.prazoConclusao); return signal ? <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${deadlineSignalTone(signal)}`}>{deadlineSignalLabel(signal)}</span> : null; })()}
                                    </div>
                                    <div className="mt-3 grid gap-1 text-xs text-slate-500">
                                      <span>Prazo: {formatDateOnlyPtBr(task.prazoConclusao, "-")}</span>
                                      {formatTaskTimeLabel(task) ? <span>Horario: {formatTaskTimeLabel(task)}</span> : null}
                                      {task.setorDestino ? <span className="font-semibold uppercase tracking-[0.14em] text-blue-700">Ao concluir, tramita para {task.setorDestino.sigla}</span> : null}
                                      <span>{task.geradaAutomaticamente ? "Origem automatica pelo fluxo do assunto." : "Origem manual."}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                  <Button onClick={() => onCompleteTask(task)} size="sm" type="button">Concluir</Button>
                                  <Button onClick={() => onEditTask(task)} size="sm" type="button" variant="secondary">Editar</Button>
                                  <Button onClick={() => onDeleteTask(task)} size="sm" type="button" variant="ghost">Excluir</Button>
                                </div>
                              </div>
                            </div>
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>
                    )}
                  </div>
                  <aside className="grid h-fit gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Operacao rapida</p>
                      <p className="mt-1 text-sm text-slate-600">Use os cards para concluir, editar, excluir e arrastar a ordem das tarefas.</p>
                    </div>
                    <Button onClick={() => setActiveTab("nova")} type="button" variant="outline">Abrir formulario de nova tarefa</Button>
                  </aside>
                </div>
              </TabsContent>

              <TabsContent className="mt-0" value="concluidas">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950">Historico de concluidas</p>
                    <span className="text-xs text-slate-500">{completedTasks.length} concluida(s)</span>
                  </div>
                  {completedTasks.length === 0 ? (
                    <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Nada concluido ainda.</p>
                  ) : completedTasks.map((task) => (
                    <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3" key={task.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-emerald-950">{task.descricao}</p>
                        {task.urgente ? <span className="inline-flex rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">Urgente</span> : null}
                      </div>
                      <p className="mt-1 text-sm text-emerald-800">Concluida em {task.concluidaEm ? new Date(task.concluidaEm).toLocaleString("pt-BR") : "-"}</p>
                      <div className="mt-2 grid gap-1 text-xs text-emerald-900/80">
                        <span>{task.tipo}{task.concluidaPor ? ` - ${task.concluidaPor.name}` : ""}</span>
                        {formatTaskTimeLabel(task) ? <span>Horario: {formatTaskTimeLabel(task)}</span> : null}
                        {formatRecorrenciaLabel(task) ? <span>{formatRecorrenciaLabel(task)}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent className="mt-0" value="analitico">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950">Tabela analitica das proximas tarefas</p>
                    <span className="text-xs text-slate-500">{pendingTasks.length} pendente(s)</span>
                  </div>
                  {pendingTasks.length === 0 ? (
                    <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Nenhuma proxima tarefa pendente.</p>
                  ) : (
                    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th className="px-4 py-3 font-semibold">Ordem</th>
                              <th className="px-4 py-3 font-semibold">Tarefa</th>
                              <th className="px-4 py-3 font-semibold">Tipo</th>
                              <th className="px-4 py-3 font-semibold">Prazo</th>
                              <th className="px-4 py-3 font-semibold">Setor destino</th>
                              <th className="px-4 py-3 font-semibold">Origem</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingTasks.map((task) => (
                              <tr className="border-t border-slate-200" key={`table-${task.id}`}>
                                <td className="px-4 py-3 font-semibold text-slate-950">{task.ordem}</td>
                                <td className="px-4 py-3 text-slate-950">{task.descricao}</td>
                                <td className="px-4 py-3 text-slate-600">{task.tipo}{formatRecorrenciaLabel(task) ? ` - ${formatRecorrenciaLabel(task)}` : ""}</td>
                                <td className="px-4 py-3 text-slate-600">
                                  <div className="grid gap-1">
                                    <span>{formatDateOnlyPtBr(task.prazoConclusao)}</span>
                                    {(() => { const signal = getTaskSignal(task.prazoConclusao); return signal ? <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${deadlineSignalTone(signal)}`}>{deadlineSignalLabel(signal)}</span> : null; })()}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-slate-600">{task.setorDestino ? `${task.setorDestino.sigla} - ${task.setorDestino.nomeCompleto}` : "-"}</td>
                                <td className="px-4 py-3 text-slate-600">{task.geradaAutomaticamente ? "Fluxo do assunto" : "Lancamento manual"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t border-slate-200 px-6 py-4">
          <Button onClick={editingTask ? onCancelEdit : onClose} type="button" variant="ghost">
            {editingTask ? "Cancelar edicao" : "Fechar"}
          </Button>
          {selectedTab === "nova" ? (
            <Button disabled={saveDisabled} onClick={editingTask ? onSaveTask : onCreateTask} type="button">
              {editingTask ? "Salvar alteracoes" : "Criar tarefa"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


