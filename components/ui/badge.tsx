import { cn } from "@/lib/utils"
import { HTMLAttributes } from "react"

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "primary" | "secondary" | "green" | "yellow" | "red" | "purple"
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
        {
          "bg-raised text-fg-muted border border-line-strong": variant === "default",
          "bg-brand/15 text-brand-ink border border-brand/30": variant === "primary" || variant === "yellow",
          "bg-info/10 text-info border border-info/30": variant === "secondary",
          "bg-ok/10 text-ok border border-ok/30": variant === "green",
          "bg-danger/15 text-danger border border-danger/30": variant === "red",
          "bg-violet/10 text-violet border border-violet/30": variant === "purple",
        },
        className
      )}
      {...props}
    />
  )
}
