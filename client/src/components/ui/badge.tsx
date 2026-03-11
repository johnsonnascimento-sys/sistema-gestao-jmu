import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1", {
  variants: {
    variant: {
      neutral: "bg-slate-100/90 text-slate-700 ring-slate-200/80",
      warning: "bg-amber-100/90 text-amber-900 ring-amber-200/90",
      success: "bg-emerald-100/90 text-emerald-900 ring-emerald-200/90",
      outline: "bg-white/75 text-slate-700 ring-sky-200/80",
      destructive: "bg-rose-100/90 text-rose-900 ring-rose-200/90",
    },
  },
  defaultVariants: {
    variant: "neutral",
  },
});

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
