import { FormEvent } from "react";
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

type TaskCreateForm = {
  descricao: string;
  tipo: "fixa" | "livre";
  prazo_conclusao: string;
  horario_inicio: string;
  horario_fim: string;
  recorrencia_tipo: "" | TarefaRecorrenciaTipo;
  recorrencia_dias_semana: string[];
  recorrencia_dia_mes: string;
  setor_destino_id: string;
  assinatura_interessado_id: string;
};

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
  onDeleteTask: (task: TarefaPendente) => void;
  onReorderTasks: (tasks: TarefaPendente[]) => void;
}) {
  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tarefas do processo</DialogTitle>
          <DialogDescription>
            Todo o CRUD de tarefas fica concentrado aqui. A pagina do processo mostra apenas as pendentes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          <div className="grid gap-3">
            <Input
              className="w-full"
              onChange={(event) => onTaskFormChange({ ...taskForm, descricao: event.target.value })}
              placeholder="Descreva a proxima tarefa"
              value={taskForm.descricao}
            />
            <div className="grid gap-3 md:grid-cols-[160px_1fr]">
              <FormField label="Tipo">
                <select
                  className={selectClassName}
                  onChange={(event) => onTaskFormChange({ ...taskForm, tipo: event.target.value as "fixa" | "livre" })}
                  value={taskForm.tipo}
                >
                  <option value="livre">Livre</option>
                  <option value="fixa">Fixa</option>
                </select>
              </FormField>
              <FormField
                hint="Sem recorrencia, esta e a data final da tarefa. Com recorrencia, ela vira a base para as proximas ocorrencias."
                label="Prazo da tarefa"
              >
                <Input
                  max={record.prazoProcesso ?? undefined}
                  onChange={(event) => onTaskFormChange({ ...taskForm, prazo_conclusao: event.target.value })}
                  type="date"
                  value={taskForm.prazo_conclusao}
                />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField hint="Opcional." label="Horario de inicio">
                <Input
                  onChange={(event) => onTaskFormChange({ ...taskForm, horario_inicio: event.target.value })}
                  type="time"
                  value={taskForm.horario_inicio}
                />
              </FormField>
              <FormField hint="Opcional." label="Horario de termino">
                <Input
                  onChange={(event) => onTaskFormChange({ ...taskForm, horario_fim: event.target.value })}
                  type="time"
                  value={taskForm.horario_fim}
                />
              </FormField>
            </div>

            <div className="grid gap-2 rounded-[20px] border border-amber-200 bg-amber-50/70 p-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-800">Sugestoes de agenda</p>
                <p className="text-xs text-amber-900/80">
                  Dias e horarios com menor carga de tarefas pendentes. Clique em uma sugestao para preencher.
                </p>
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
          </div>

          <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
            <FormField
              hint="Escolha apenas se a tarefa precisar voltar a ser criada depois da conclusao."
              label="Recorrencia"
            >
              <select
                className={selectClassName}
                onChange={(event) =>
                  onTaskFormChange({
                    ...taskForm,
                    recorrencia_tipo: event.target.value as "" | TarefaRecorrenciaTipo,
                    recorrencia_dias_semana: event.target.value === "semanal" ? taskForm.recorrencia_dias_semana : [],
                    recorrencia_dia_mes: event.target.value === "mensal" ? taskForm.recorrencia_dia_mes : "",
                  })
                }
                value={taskForm.recorrencia_tipo}
              >
                <option value="">Sem repeticao</option>
                <option value="diaria">Diaria</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
              </select>
            </FormField>

            {taskForm.recorrencia_tipo ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
                Essa recorrencia continua ate {formatDateOnlyPtBr(record.prazoProcesso, "o prazo do processo")}. Depois
                dessa data, o sistema nao cria novas tarefas.
              </div>
            ) : null}

            {taskForm.recorrencia_tipo === "semanal" ? (
              <div className="grid gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Dias da semana</p>
                  <p className="text-xs text-slate-500">Escolha em quais dias a proxima tarefa deve reaparecer.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((item) => (
                    <Button
                      key={item}
                      onClick={() =>
                        onTaskFormChange({
                          ...taskForm,
                          recorrencia_dias_semana: taskForm.recorrencia_dias_semana.includes(item)
                            ? taskForm.recorrencia_dias_semana.filter((value) => value !== item)
                            : [...taskForm.recorrencia_dias_semana, item],
                        })
                      }
                      size="sm"
                      type="button"
                      variant={taskForm.recorrencia_dias_semana.includes(item) ? "primary" : "outline"}
                    >
                      {item}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {taskForm.recorrencia_tipo === "mensal" ? (
              <FormField hint="A tarefa sera repetida nesse dia em cada mes." label="Dia do mes">
                <Input
                  max="31"
                  min="1"
                  onChange={(event) => onTaskFormChange({ ...taskForm, recorrencia_dia_mes: event.target.value })}
                  type="number"
                  value={taskForm.recorrencia_dia_mes}
                />
              </FormField>
            ) : taskForm.recorrencia_tipo === "diaria" ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                A recorrencia diaria nao precisa de dia da semana nem dia do mes.
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                Sem repeticao. A tarefa termina no prazo escolhido.
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500">
            Toda tarefa precisa de prazo de conclusao e nao pode passar de{" "}
            {formatDateOnlyPtBr(record.prazoProcesso, "o prazo do processo")}.
          </p>

          {requiresTaskSetorDestino ? (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <select
                className="min-w-0 h-11 rounded-full border border-slate-200 bg-white px-4 text-sm"
                onChange={(event) => onTaskFormChange({ ...taskForm, setor_destino_id: event.target.value })}
                value={taskForm.setor_destino_id}
              >
                <option value="">Escolha o setor destino</option>
                {setores.map((setor) => (
                  <option key={setor.id} value={setor.id}>
                    {setor.sigla} - {setor.nomeCompleto}
                  </option>
                ))}
              </select>
              <p className="min-w-0 text-xs text-slate-500 md:self-center">
                Ao concluir, o processo sera tramitado automaticamente para o setor escolhido.
              </p>
            </div>
          ) : null}

          {requiresTaskSignaturePerson ? (
            <div className="grid gap-3">
              <div className="grid gap-2 rounded-[20px] border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  Pessoas vinculadas ao processo
                </p>
                {interessadosLoading ? (
                  <p className="text-xs text-slate-400">Carregando pessoas vinculadas...</p>
                ) : interessados.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhuma pessoa vinculada a este processo.</p>
                ) : (
                  <div className="grid gap-2">
                    {interessados.map((item) => (
                      <button
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                          taskForm.assinatura_interessado_id === item.interessado.id
                            ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                            : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40"
                        }`}
                        key={item.interessado.id}
                        onClick={() =>
                          onTaskFormChange({
                            ...taskForm,
                            assinatura_interessado_id: item.interessado.id,
                          })
                        }
                        type="button"
                      >
                        <span className="font-medium">
                          {item.interessado.nome}
                          {item.interessado.cargo ? (
                            <span className="ml-1 text-xs font-normal text-slate-500">- {item.interessado.cargo}</span>
                          ) : null}
                        </span>
                        {taskForm.assinatura_interessado_id === item.interessado.id ? (
                          <span className="text-xs font-semibold text-indigo-600">Selecionado</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  className="mt-1 flex items-center gap-1 text-xs text-indigo-600 transition-colors hover:text-indigo-800"
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
                          taskForm.assinatura_interessado_id === item.id
                            ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                            : "border-slate-200 bg-white hover:border-indigo-200"
                        }`}
                        key={item.id}
                        onClick={() =>
                          onTaskFormChange({
                            ...taskForm,
                            assinatura_interessado_id: item.id,
                          })
                        }
                        type="button"
                      >
                        <span className="font-medium">
                          {item.nome}
                          {item.cargo ? <span className="ml-1 text-xs font-normal text-slate-500">- {item.cargo}</span> : null}
                        </span>
                        {taskForm.assinatura_interessado_id === item.id ? (
                          <span className="text-xs font-semibold text-indigo-600">Selecionado</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">
                A tarefa sera nomeada automaticamente com o nome da pessoa selecionada.
                {signatureSelectedName ? ` Selecionada: ${signatureSelectedName}.` : ""}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <select
              className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm"
              onChange={(event) =>
                onTaskFormChange({
                  ...taskForm,
                  descricao: event.target.value,
                  tipo: "fixa",
                  setor_destino_id:
                    event.target.value === "Envio para" || event.target.value === "Retorno do setor"
                      ? taskForm.setor_destino_id
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
            <p className="text-xs text-slate-500 md:self-center">
              Os atalhos consideram envolvidos. Arraste as tarefas pendentes para reorganizar.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {taskShortcutOptions.slice(0, 6).map((item) => (
              <Button
                key={item}
                onClick={() =>
                  onTaskFormChange({
                    ...taskForm,
                    descricao: item,
                    tipo: "fixa",
                    setor_destino_id:
                      item === "Envio para" || item === "Retorno do setor" ? taskForm.setor_destino_id : "",
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

          <div className="flex justify-end">
            <Button
              disabled={
                taskForm.descricao.trim().length < 3 ||
                !taskForm.prazo_conclusao ||
                (requiresTaskSetorDestino && !taskForm.setor_destino_id) ||
                (requiresTaskSignaturePerson && !taskForm.assinatura_interessado_id) ||
                isSubmitting
              }
              onClick={onCreateTask}
              type="button"
            >
              Criar tarefa
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-3">
              <p className="text-sm font-semibold text-slate-950">Pendentes</p>
              {pendingTasks.length === 0 ? (
                <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  Nenhuma tarefa pendente.
                </p>
              ) : (
                <Reorder.Group axis="y" className="grid gap-3" onReorder={onReorderTasks} values={pendingTasks}>
                  {pendingTasks.map((task) => (
                    <Reorder.Item key={task.id} value={task}>
                      <div className="cursor-grab rounded-[22px] border border-slate-200 bg-white px-4 py-3 transition-shadow hover:shadow-md active:cursor-grabbing">
                        <div className="flex items-start gap-3">
                          <input
                            className="mt-1 h-4 w-4 accent-slate-950"
                            onChange={() => onCompleteTask(task)}
                            type="checkbox"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="block font-semibold text-slate-950">{task.descricao}</span>
                            <span className="text-sm text-slate-500">{task.tipo}</span>
                            {task.prazoConclusao ? (
                              <span className="block text-xs text-slate-500">
                                Prazo de conclusao: {formatDateOnlyPtBr(task.prazoConclusao)}
                              </span>
                            ) : null}
                            {formatTaskTimeLabel(task) ? (
                              <span className="block text-xs text-slate-500">
                                Horario: {formatTaskTimeLabel(task)}
                              </span>
                            ) : null}
                            {(() => {
                              const signal = getTaskSignal(task.prazoConclusao);
                              return signal ? (
                                <span
                                  className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${deadlineSignalTone(signal)}`}
                                >
                                  Prazo da tarefa: {deadlineSignalLabel(signal)}
                                </span>
                              ) : null;
                            })()}
                            {formatRecorrenciaLabel(task) ? (
                              <span className="mt-1 inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-800 ring-1 ring-sky-200">
                                {formatRecorrenciaLabel(task)}
                              </span>
                            ) : null}
                            {formatRecorrenciaLabel(task) ? (
                              <span className="mt-1 block text-xs text-sky-700">
                                Recorrencia ativa ate {formatDateOnlyPtBr(record.prazoProcesso, "o prazo do processo")}.
                              </span>
                            ) : null}
                            {task.setorDestino ? (
                              <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                                Ao concluir, tramita para {task.setorDestino.sigla}
                              </span>
                            ) : null}
                            {task.geradaAutomaticamente ? (
                              <span className="mt-1 block text-xs text-slate-500">
                                Gerada automaticamente pelo fluxo do assunto.
                              </span>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button onClick={() => onEditTask(task)} size="sm" type="button" variant="secondary">
                              Editar
                            </Button>
                            <Button onClick={() => onDeleteTask(task)} size="sm" type="button" variant="ghost">
                              Excluir
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              )}
            </div>

            <div className="grid gap-3">
              <p className="text-sm font-semibold text-slate-950">Concluidas</p>
              {completedTasks.length === 0 ? (
                <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  Nada concluido ainda.
                </p>
              ) : (
                completedTasks.map((task) => (
                  <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3" key={task.id}>
                    <p className="font-semibold text-emerald-950">{task.descricao}</p>
                    <p className="text-sm text-emerald-800">
                      Concluida em {task.concluidaEm ? new Date(task.concluidaEm).toLocaleString("pt-BR") : "-"}
                    </p>
                    {formatTaskTimeLabel(task) ? <p className="mt-1 text-xs text-emerald-900/80">Horario: {formatTaskTimeLabel(task)}</p> : null}
                    <p className="mt-1 text-xs text-emerald-900/80">
                      {task.tipo}
                      {task.concluidaPor ? ` - ${task.concluidaPor.name}` : ""}
                    </p>
                    {formatRecorrenciaLabel(task) ? (
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-900">
                        {formatRecorrenciaLabel(task)}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-950">Tabela analitica das proximas tarefas</p>
              <span className="text-xs text-slate-500">{pendingTasks.length} pendente(s)</span>
            </div>
            {pendingTasks.length === 0 ? (
              <p className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Nenhuma proxima tarefa pendente.
              </p>
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
                          <td className="px-4 py-3 text-slate-600">
                            {task.tipo}
                            {formatRecorrenciaLabel(task) ? ` - ${formatRecorrenciaLabel(task)}` : ""}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <div className="grid gap-1">
                              <span>{formatDateOnlyPtBr(task.prazoConclusao)}</span>
                              {(() => {
                                const signal = getTaskSignal(task.prazoConclusao);
                                return signal ? (
                                  <span
                                    className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${deadlineSignalTone(signal)}`}
                                  >
                                    {deadlineSignalLabel(signal)}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {task.setorDestino ? `${task.setorDestino.sigla} - ${task.setorDestino.nomeCompleto}` : "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {task.geradaAutomaticamente ? "Fluxo do assunto" : "Lancamento manual"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


