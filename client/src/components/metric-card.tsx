import { Card, CardContent } from "./ui/card";

export function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="grid gap-3 p-6">
        <span className="text-sm text-slate-500">{label}</span>
        <strong className='font-["IBM_Plex_Serif",Georgia,serif] text-4xl text-slate-950'>{value}</strong>
      </CardContent>
    </Card>
  );
}
