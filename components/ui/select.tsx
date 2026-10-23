import { cn } from "@/lib/utils"
import { SelectHTMLAttributes, forwardRef } from "react"

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-line-strong bg-surface px-3 py-1 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-info focus:border-info disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:focus:ring-danger",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
)
Select.displayName = "Select"
