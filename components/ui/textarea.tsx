import { cn } from "@/lib/utils"
import { TextareaHTMLAttributes, forwardRef } from "react"

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-20 w-full rounded-md border border-[#3a3435] bg-[#251f20] px-3 py-2 text-sm text-[#f5f0f0] placeholder:text-[#5e5858] focus:outline-none focus:ring-2 focus:ring-[#FBD00D] focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 resize-none",
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = "Textarea"
