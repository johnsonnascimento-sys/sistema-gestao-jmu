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
    <header
      className={cn(
        "panel-noise flex flex-col gap-5 rounded-[36px] border border-white/75 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(247,241,233,0.78))] px-6 py-6 shadow-[0_28px_72px_rgba(20,33,61,0.08)] backdrop-blur-xl lg:flex-row lg:items-end lg:justify-between lg:px-8",
        className,
      )}
    >
      <div className="space-y-3">
        {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.3em] text-rose-700">{eyebrow}</p> : null}
        <h1 className='font-["IBM_Plex_Serif",Georgia,serif] text-3xl leading-tight text-slate-950 sm:text-5xl'>{title}</h1>
        {description ? <p className="max-w-3xl text-sm leading-7 text-slate-500 sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
