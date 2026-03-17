import { Link } from "react-router-dom";
import { Card, CardContent } from "./ui/card";

export function MetricCard({ label, to, value }: { label: string; value: number; to?: string }) {
  const content = (
    <CardContent className="grid gap-3 p-5">
      <span className="inline-flex w-fit items-center rounded-full bg-slate-100/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 ring-1 ring-slate-200/50 backdrop-blur-sm">
        {label}
      </span>
      <strong className='font-sans text-4xl font-light tracking-tight text-slate-900'>{value}</strong>
    </CardContent>
  );

  return (
    <Card className={to ? "cursor-pointer border-white/60 bg-white/50 backdrop-blur-md shadow-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/80 hover:shadow-xl" : "border-white/60 bg-white/50 backdrop-blur-md shadow-sm"}>
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
