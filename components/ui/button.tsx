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
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBD00D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e0b0b] disabled:pointer-events-none disabled:opacity-40",
          {
            "bg-[#FBD00D] text-[#1a1718] hover:bg-[#e6bc0c]": variant === "default",
            "bg-[#002484] text-white hover:bg-[#001e70]": variant === "secondary",
            "border border-[#3a3435] bg-transparent text-[#f5f0f0] hover:bg-[#251f20] hover:border-[#5e5858]": variant === "outline",
            "bg-transparent text-[#9a9090] hover:bg-[#251f20] hover:text-[#f5f0f0]": variant === "ghost",
            "bg-[#ED1F24] text-white hover:bg-[#d61c21]": variant === "destructive",
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
