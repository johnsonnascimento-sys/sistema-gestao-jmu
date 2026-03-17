import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-r from-indigo-800 via-indigo-600 to-violet-500 text-white shadow-[0_18px_40px_rgba(79,70,229,0.2)] hover:-translate-y-0.5 hover:shadow-[0_24px_50px_rgba(124,58,237,0.24)]",
        secondary:
          "bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(243,247,250,0.92))] text-slate-900 ring-1 ring-slate-200/80 shadow-[0_10px_24px_rgba(20,33,61,0.08)] hover:bg-white hover:ring-slate-300/80",
        ghost:
          "bg-transparent text-slate-700 hover:bg-indigo-950/5 hover:text-slate-950",
        outline:
          "bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(241,245,249,0.9))] text-slate-900 ring-1 ring-slate-200/80 hover:ring-indigo-300",
        destructive:
          "bg-gradient-to-r from-rose-700 to-rose-600 text-white shadow-[0_16px_36px_rgba(190,24,93,0.22)] hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(190,24,93,0.26)]",
      },
      size: {
        sm: "h-9 px-4",
        md: "h-11 px-5",
        lg: "h-12 px-6",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ asChild, className, size, variant, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
