import { ChevronDown, FilePlus2 } from "lucide-react";
import { ReactNode, useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

// ── SummaryItem ──────────────────────────────────────────────────────────────

export function SummaryItem({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <div className="mt-1 whitespace-pre-wrap text-slate-950">{value}</div>
    </div>
  );
}

// ── DetailSectionCard ────────────────────────────────────────────────────────

export function DetailSectionCard({
  children,
  defaultOpen = false,
  summary,
  title,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  summary?: string | null;
  title: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className={open ? "h-fit self-start" : "h-fit self-start overflow-hidden"}>
      <button
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 text-left transition hover:bg-white/40 ${open ? "px-5 py-3.5" : "px-4 py-2.5"}`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <div className="min-w-0">
          <p className={`${open ? "text-sm" : "text-[0.82rem]"} font-semibold text-slate-950`}>
            {title}
          </p>
          <p className={`truncate text-slate-500 ${open ? "mt-0.5 text-xs" : "text-[0.72rem]"}`}>
            {summary ?? "Sem resumo disponivel."}
          </p>
        </div>
        <div className={`flex shrink-0 items-center ${open ? "gap-3" : "gap-2"}`}>
          {open ? (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-rose-800">
              Em destaque
            </span>
          ) : null}
          <span
            className={`flex items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm ${open ? "h-8 w-8" : "h-7 w-7"}`}
          >
            <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
          </span>
        </div>
      </button>
      {open ? children : null}
    </Card>
  );
}

// ── ToolbarActionButton ──────────────────────────────────────────────────────

export function ToolbarActionButton({
  icon: Icon,
  label,
  title,
  onClick,
  variant = "secondary",
}: {
  icon: typeof FilePlus2;
  label: string;
  title: string;
  onClick: () => void;
  variant?: "secondary" | "ghost";
}) {
  return (
    <Button
      className="h-auto min-w-[92px] flex-col rounded-[24px] border border-white/10 px-4 py-3 text-xs shadow-[0_12px_26px_rgba(20,33,61,0.12)]"
      onClick={onClick}
      title={title}
      type="button"
      variant={variant}
    >
      <Icon className="h-5 w-5" />
      <span className="font-semibold">{label}</span>
    </Button>
  );
}
