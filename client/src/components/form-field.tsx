import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export function FormField({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("grid gap-2.5 text-sm font-medium text-slate-800", className)}>
      <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">{label}</span>
      {children}
      {error ? <span className="text-xs font-medium text-rose-700">{error}</span> : hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
