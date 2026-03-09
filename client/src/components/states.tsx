import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";

function StateFrame({
  icon,
  title,
  description,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-40 flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center", className)}>
      <div className="mb-4 rounded-full bg-slate-100 p-3 text-slate-600">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      {description ? <p className="mt-2 max-w-xl text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}

export function LoadingState({ title = "Carregando", description = "Aguarde enquanto os dados sao carregados." }: { title?: string; description?: string }) {
  return <StateFrame description={description} icon={<LoaderCircle className="h-5 w-5 animate-spin" />} title={title} />;
}

export function ErrorState({ title = "Falha ao carregar", description }: { title?: string; description: string }) {
  return <StateFrame className="border-rose-200 bg-rose-50/70" description={description} icon={<AlertTriangle className="h-5 w-5" />} title={title} />;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <StateFrame description={description} icon={<Inbox className="h-5 w-5" />} title={title} />;
}
