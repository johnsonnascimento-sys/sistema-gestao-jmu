import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PreDemanda, TarefaPendente } from "../types";
import { TarefasDialog } from "./pre-demanda-detail-dialogs";

function buildTask(overrides: Partial<TarefaPendente> = {}): TarefaPendente {
  return {
    id: "task-1",
    preId: "PRE-2026-0267",
    ordem: 1,
    descricao: "Mandei e-mail para todos",
    tipo: "livre",
    urgente: false,
    assuntoId: null,
    procedimentoId: null,
    prazoConclusao: "2026-06-03",
    horarioInicio: null,
    horarioFim: null,
    recorrenciaTipo: null,
    recorrenciaDiasSemana: null,
    recorrenciaDiaMes: null,
    prazoReferencia: null,
    prazoData: null,
    setorDestino: null,
    geradaAutomaticamente: false,
    concluida: false,
    concluidaEm: null,
    concluidaPor: null,
    createdAt: "2026-06-03T10:00:00.000Z",
    createdBy: null,
    ...overrides,
  };
}

function buildRecord(): PreDemanda {
  return {
    id: 1,
    preId: "PRE-2026-0267",
    solicitante: "Pessoa teste",
    pessoaPrincipal: null,
    principalNumero: null,
    principalTipo: null,
    assunto: "Assunto teste",
    dataReferencia: "2026-06-03",
    status: "em_andamento",
    descricao: "Descricao teste",
    fonte: null,
    observacoes: null,
    prazoProcesso: "2026-06-30",
    proximoPrazoTarefa: null,
    prazoStatus: "no_prazo",
    prazoInicial: null,
    prazoIntermediario: null,
    prazoFinal: null,
    dataConclusao: null,
    numeroJudicial: null,
    anotacoes: null,
    setorAtual: null,
    metadata: {
      frequencia: null,
      frequenciaDiasSemana: null,
      frequenciaDiaMes: null,
      pagamentoEnvolvido: false,
      urgente: false,
      urgenteManual: false,
      audienciaData: null,
      audienciaStatus: null,
      audienciaHorarioInicio: null,
      audienciaHorarioFim: null,
      audienciaSala: null,
      audienciaDescricao: null,
      reaberturaProgramada: null,
      reaberturaProgramadaData: null,
      reaberturaProgramadaMotivo: null,
      reaberturaProgramadaModo: null,
      reaberturaProgramadaDias: null,
      reaberturaProgramadaStatus: null,
    },
    createdAt: "2026-06-03T10:00:00.000Z",
    updatedAt: "2026-06-03T10:00:00.000Z",
    createdBy: null,
    currentAssociation: null,
    assuntos: [],
    seiAssociations: [],
    numerosJudiciais: [],
    queueHealth: {
      level: "fresh",
      staleDays: 0,
      ageDays: 1,
      attentionDays: 3,
      criticalDays: 7,
    },
    allowedNextStatuses: [],
    interessados: [],
    vinculos: [],
    setoresAtivos: [],
    documentos: [],
    comentarios: [],
    tarefasPendentes: [],
    recentAndamentos: [],
    audiencias: [],
  };
}

function Harness() {
  const [editingTask, setEditingTask] = useState<TarefaPendente | null>(null);

  const props = {
    completedTasks: [],
    editTaskForm: {
      descricao: "",
      tipo: "livre",
      urgente: false,
      prazo_conclusao: "2026-06-30",
      horario_inicio: "",
      horario_fim: "",
      recorrencia_tipo: "",
      recorrencia_dias_semana: [],
      recorrencia_dia_mes: "",
    },
    editingTask,
    interessados: [],
    interessadosLoading: false,
    isSubmitting: false,
    onApplyTaskSuggestion: vi.fn(),
    onCancelEdit: vi.fn(),
    onClose: vi.fn(),
    onCompleteTask: vi.fn(),
    onCreateTask: vi.fn(),
    onDeleteTask: vi.fn(),
    onEditTask: setEditingTask,
    onEditTaskFormChange: vi.fn(),
    onReorderTasks: vi.fn(),
    onSaveTask: vi.fn(),
    onSignatureExpandedChange: vi.fn(),
    onSignatureSearchChange: vi.fn(),
    onTaskFormChange: vi.fn(),
    open: true,
    pendingTasks: [buildTask()],
    record: buildRecord(),
    requiresTaskSetorDestino: false,
    requiresTaskSignaturePerson: false,
    setores: [],
    signatureExpanded: false,
    signatureSearch: "",
    signatureSearchResults: [],
    signatureSelectedName: "",
    taskForm: {
      descricao: "",
      tipo: "livre",
      urgente: false,
      prazo_conclusao: "2026-06-30",
      horario_inicio: "",
      horario_fim: "",
      recorrencia_tipo: "",
      recorrencia_dias_semana: [],
      recorrencia_dia_mes: "",
      setor_destino_id: "",
      assinatura_interessado_id: "",
    },
    taskShortcutOptions: [],
    taskSuggestions: [],
    taskSuggestionsLoading: false,
  } satisfies ComponentProps<typeof TarefasDialog>;

  return <TarefasDialog {...props} />;
}

describe("TarefasDialog", () => {
  it("abre o editor ao clicar no card da tarefa", async () => {
    const user = userEvent.setup();

    render(<Harness />);

    await user.click(
      screen.getByRole("button", {
        name: /editar tarefa mandei e-mail para todos/i,
      }),
    );

    await screen.findByRole("tab", { name: "Editar tarefa" });

    expect(
      within(screen.getByRole("dialog", { name: "Tarefas do processo" })).getByRole(
        "button",
        { name: "Salvar alteracoes" },
      ),
    ).toBeInTheDocument();
  });
});
