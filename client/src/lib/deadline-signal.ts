export type DeadlineSignal = "atrasado" | "no_prazo";

export function getDeadlineSignal(prazo: string | null | undefined): DeadlineSignal | null {
  if (!prazo) return null;

  const dueDate = new Date(`${prazo}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return dueDate.getTime() < today.getTime() ? "atrasado" : "no_prazo";
}

export function deadlineSignalLabel(signal: DeadlineSignal) {
  return signal === "atrasado" ? "Atrasado" : "No prazo";
}

export function deadlineSignalTone(signal: DeadlineSignal) {
  return signal === "atrasado" ? "bg-rose-100 text-rose-700 ring-1 ring-rose-200" : "bg-sky-100 text-sky-700 ring-1 ring-sky-200";
}
