import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="space-y-2">
        {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.28em] text-rose-600">{eyebrow}</p> : null}
        <h1 className='font-["IBM_Plex_Serif",Georgia,serif] text-3xl text-slate-950 sm:text-4xl'>{title}</h1>
        {description ? <p className="max-w-3xl text-sm text-slate-500 sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
