import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";

export function FilterBar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-4 rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-[0_24px_60px_rgba(20,33,61,0.08)] backdrop-blur lg:grid-cols-[2fr_1fr_1fr_1fr_auto]", className)} {...props} />;
}
