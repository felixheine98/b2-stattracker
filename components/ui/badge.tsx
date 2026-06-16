import { cn } from "@/lib/utils"
import { HTMLAttributes } from "react"

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "cyan" | "green" | "yellow" | "red" | "purple"
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        {
          "bg-slate-700 text-slate-300": variant === "default",
          "bg-cyan-900 text-cyan-300 border border-cyan-800": variant === "cyan",
          "bg-green-900 text-green-300 border border-green-800": variant === "green",
          "bg-yellow-900 text-yellow-300 border border-yellow-800": variant === "yellow",
          "bg-red-900 text-red-300 border border-red-800": variant === "red",
          "bg-purple-900 text-purple-300 border border-purple-800": variant === "purple",
        },
        className
      )}
      {...props}
    />
  )
}
