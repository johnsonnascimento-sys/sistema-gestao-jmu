import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";

export function FilterBar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "panel-noise grid gap-4 rounded-[32px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,241,233,0.85))] p-6 shadow-[0_24px_64px_rgba(20,33,61,0.08)] backdrop-blur-xl lg:grid-cols-[2fr_1fr_1fr_1fr_auto]",
        className,
      )}
      {...props}
    />
  );
}
