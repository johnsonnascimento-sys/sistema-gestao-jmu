import { Card, CardContent } from "./ui/card";

export function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="grid gap-4 p-6">
        <span className="inline-flex w-fit items-center rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-rose-900 ring-1 ring-rose-100">
          {label}
        </span>
        <strong className='font-["IBM_Plex_Serif",Georgia,serif] text-4xl leading-none text-slate-950'>{value}</strong>
      </CardContent>
    </Card>
  );
}
