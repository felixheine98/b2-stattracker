import { formatPacePct, paceTooltip } from "@/lib/pace"

// A pace in percent; hovering it shows what that comes to in seconds
export function PacePct({ pct, ms }: { pct: number | null; ms: number | null }) {
  const title = paceTooltip(ms)
  return <span title={title} className={title && "cursor-help"}>{formatPacePct(pct)}</span>
}
