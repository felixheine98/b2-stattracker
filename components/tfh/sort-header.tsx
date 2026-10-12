import { cn } from "@/lib/utils"

// A column heading that sorts its table: the first click ranks best first, the next one turns it around
export function SortHeader({ label, active, order, onClick, className }: { label: string; active: boolean; order: "best" | "worst"; onClick: () => void; className?: string }) {
  return (
    <th onClick={onClick} aria-sort={active ? (order === "best" ? "descending" : "ascending") : undefined} className={cn("group cursor-pointer select-none", className)}>
      <span className="inline-flex items-center gap-1">
        <span className={cn("transition-colors", active ? "text-fg" : "group-hover:text-fg")}>{label}</span>
        <span className={cn("text-[9px]", active ? "text-brand-ink" : "text-line-strong")}>{active && order === "worst" ? "▲" : "▼"}</span>
      </span>
    </th>
  )
}
