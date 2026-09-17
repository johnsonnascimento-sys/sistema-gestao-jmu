import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";

function renderDialog(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();

  const result = render(
    <ConfirmDialog
      confirmLabel="Concluir processo"
      description="Registre o motivo."
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open
      requireReason
      title="Concluir processo"
      {...overrides}
    />,
  );

  return { onConfirm, onOpenChange, ...result };
}

describe("ConfirmDialog", () => {
  afterEach(cleanup);

  it("exibe textos padrao somente quando configurados", () => {
    const { unmount } = renderDialog();
    expect(screen.queryByLabelText("Texto padrao")).not.toBeInTheDocument();

    unmount();
    renderDialog({ reasonPresetOptions: ["Sem mais providências"] });
    expect(screen.getByLabelText("Texto padrao")).toBeInTheDocument();
  });

  it("preenche o motivo com o texto padrao e preserva a edicao enviada", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog({ reasonPresetOptions: ["Sem mais providências"] });

    await user.selectOptions(screen.getByLabelText("Texto padrao"), "Sem mais providências");
    const motivo = screen.getByPlaceholderText("Descreva a razao operacional.");
    expect(motivo).toHaveValue("Sem mais providências");

    await user.clear(motivo);
    await user.type(motivo, "Sem mais providências - revisado");
    await user.click(screen.getByRole("button", { name: "Concluir processo" }));

    expect(onConfirm).toHaveBeenCalledWith({
      motivo: "Sem mais providências - revisado",
      observacoes: "",
      extraOptionChecked: false,
      reopenSchedule: null,
    });
  });

  it("limpa o texto e a selecao ao reabrir", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ConfirmDialog
        confirmLabel="Concluir processo"
        description="Registre o motivo."
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open
        reasonPresetOptions={["Sem mais providências"]}
        requireReason
        title="Concluir processo"
      />,
    );

    await user.selectOptions(screen.getByLabelText("Texto padrao"), "Sem mais providências");
    rerender(
      <ConfirmDialog
        confirmLabel="Concluir processo"
        description="Registre o motivo."
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open={false}
        reasonPresetOptions={["Sem mais providências"]}
        requireReason
        title="Concluir processo"
      />,
    );
    rerender(
      <ConfirmDialog
        confirmLabel="Concluir processo"
        description="Registre o motivo."
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open
        reasonPresetOptions={["Sem mais providências"]}
        requireReason
        title="Concluir processo"
      />,
    );

    expect(screen.getByLabelText("Texto padrao")).toHaveValue("");
    expect(screen.getByPlaceholderText("Descreva a razao operacional.")).toHaveValue("");
  });
});
