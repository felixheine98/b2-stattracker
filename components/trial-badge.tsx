import { cn } from "@/lib/utils"

// Marks a player who takes part while on trial
export function TrialBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded border border-navy/60 bg-navy/20 px-1 text-[9px] font-medium uppercase leading-[14px] tracking-wide text-info",
        className
      )}
    >
      Trial
    </span>
  )
}
