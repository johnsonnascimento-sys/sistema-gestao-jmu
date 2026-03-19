import { deadlineSignalLabel, deadlineSignalTone, type DeadlineSignal } from "../lib/deadline-signal";

export function DeadlineStatusPill({
  signal,
  className = "",
}: {
  signal: DeadlineSignal | null;
  className?: string;
}) {
  if (!signal) return null;

  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${deadlineSignalTone(signal)} ${className}`}
    >
      {deadlineSignalLabel(signal)}
    </span>
  );
}
