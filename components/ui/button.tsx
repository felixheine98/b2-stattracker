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
          "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-40",
          {
            "bg-brand text-brand-fg hover:bg-brand-hover": variant === "default",
            "bg-navy text-white hover:bg-navy-hover": variant === "secondary",
            "border border-line-strong bg-transparent text-fg hover:bg-raised hover:border-fg-subtle": variant === "outline",
            "bg-transparent text-fg-muted hover:bg-raised hover:text-fg": variant === "ghost",
            "bg-danger text-white hover:bg-danger-hover": variant === "destructive",
          },
          {
            "h-8 px-3 text-sm": size === "sm",
            "h-9 px-4 text-sm": size === "md",
            "h-11 px-6 text-base": size === "lg",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
