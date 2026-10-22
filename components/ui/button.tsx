"use client"

import { cn } from "@/lib/utils"
import { ButtonHTMLAttributes, forwardRef } from "react"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive"
  size?: "sm" | "md" | "lg"
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-2 whitespace-normal text-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-40 max-md:min-h-11",
          {
            "bg-brand text-brand-fg hover:bg-brand-hover": variant === "default",
            "border border-line-strong bg-raised text-fg hover:bg-table-hover": variant === "secondary",
            "border border-line-strong bg-surface text-fg hover:bg-raised hover:border-fg-subtle": variant === "outline",
            "bg-transparent text-fg-muted hover:bg-raised hover:text-fg": variant === "ghost",
            "bg-danger text-white hover:bg-danger-hover": variant === "destructive",
          },
          {
            "min-h-8 py-1.5 px-3 text-sm": size === "sm",
            "min-h-10 py-2 px-4 text-sm": size === "md",
            "min-h-11 py-2.5 px-6 text-base": size === "lg",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
