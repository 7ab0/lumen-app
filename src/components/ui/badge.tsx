import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "bg-slate-100 text-slate-700",
        success: "bg-emerald-100 text-emerald-700",
        warning: "bg-amber-100 text-amber-800",
        danger: "bg-red-100 text-red-700",
        info: "bg-sky-100 text-sky-700",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// Badge de color específico para el score A/B/C/D del cliente
// (ver plan, sección "Calificación de clientes").
const SCORE_VARIANT: Record<string, BadgeProps["variant"]> = {
  A: "success",
  B: "info",
  C: "warning",
  D: "danger",
};

export function ScoreBadge({ score }: { score: "A" | "B" | "C" | "D" }) {
  return <Badge variant={SCORE_VARIANT[score]}>Score {score}</Badge>;
}
