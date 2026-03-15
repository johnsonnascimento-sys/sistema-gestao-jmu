import { Link } from "react-router-dom";
import { Card, CardContent } from "./ui/card";

export function MetricCard({ label, to, value }: { label: string; value: number; to?: string }) {
  const content = (
    <CardContent className="grid gap-4 p-6">
      <span className="inline-flex w-fit items-center rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-rose-900 ring-1 ring-rose-100">
        {label}
      </span>
      <strong className='font-["IBM_Plex_Serif",Georgia,serif] text-4xl leading-none text-slate-950'>{value}</strong>
    </CardContent>
  );

  return (
    <Card className={to ? "transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(20,33,61,0.1)]" : undefined}>
      {to ? (
        <Link aria-label={`Abrir ${label} na tabela analitica`} className="block focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200/60" to={to}>
          {content}
        </Link>
      ) : (
        content
      )}
    </Card>
  );
}
