import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-slate-950 text-white shadow-lg shadow-slate-950/15 hover:bg-slate-800",
        secondary: "bg-white/80 text-slate-900 ring-1 ring-slate-200 hover:bg-white",
        ghost: "bg-transparent text-slate-700 hover:bg-slate-950/5",
        outline: "bg-transparent text-slate-900 ring-1 ring-slate-300 hover:bg-white/70",
        destructive: "bg-rose-600 text-white shadow-lg shadow-rose-600/20 hover:bg-rose-500",
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
