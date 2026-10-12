import { cn } from "@/lib/utils"

// Marks a player who takes part as a guest rather than as a team member
export function GuestBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded border border-line-strong px-1 text-[9px] font-medium uppercase leading-[14px] tracking-wide text-fg-muted",
        className
      )}
    >
      Guest
    </span>
  )
}
