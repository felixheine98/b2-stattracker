import { cn } from "@/lib/utils"
import { HTMLAttributes } from "react"

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "primary" | "secondary" | "green" | "yellow" | "red" | "purple"
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        {
          "bg-[#251f20] text-[#9a9090] border border-[#3a3435]": variant === "default",
          "bg-[#FBD00D]/15 text-[#FBD00D] border border-[#FBD00D]/30": variant === "primary" || variant === "yellow",
          "bg-[#002484]/20 text-[#6b8fff] border border-[#002484]/40": variant === "secondary",
          "bg-green-950 text-green-400 border border-green-900": variant === "green",
          "bg-[#ED1F24]/15 text-[#ED1F24] border border-[#ED1F24]/30": variant === "red",
          "bg-purple-950 text-purple-400 border border-purple-900": variant === "purple",
        },
        className
      )}
      {...props}
    />
  )
}
