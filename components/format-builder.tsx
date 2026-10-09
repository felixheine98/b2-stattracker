import { formatLabel, formatLabelLong } from "@/lib/utils"
import type { Format } from "@prisma/client"
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react"

const ALL_FORMATS: Format[] = [
  "TIME_ATTACK_10",
  "ROUND_1V1",
  "ROUND_2V2",
  "ROUND_3V3",
  "ROUND_4V4",
  "ROUND_5V5",
]

interface Props {
  value: Format[]
  onChange: (formats: Format[]) => void
}

// The sequence of formats a tournament is played in: add from the list above, reorder and remove below
export function FormatBuilder({ value, onChange }: Props) {
  function move(from: number, to: number) {
    const next = [...value]
    next.splice(to, 0, next.splice(from, 1)[0])
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {ALL_FORMATS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onChange([...value, f])}
            className="inline-flex items-center gap-1 rounded-md border border-[#2d2829] bg-[#1c1819] px-2 py-1 text-xs text-[#9a9090] hover:border-[#FBD00D]/50 hover:text-[#f5f0f0] transition-colors"
          >
            <Plus size={10} />
            {formatLabelLong(f)}
          </button>
        ))}
      </div>
      <div className="min-h-10 rounded-lg border border-[#2d2829] bg-[#0e0c0d] p-2 flex flex-wrap gap-1.5">
        {value.length === 0 && (
          <span className="text-xs text-[#5e5858] self-center">Click formats above to build the sequence</span>
        )}
        {value.map((f, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-md border border-[#2d2829] bg-[#1c1819] px-1.5 py-0.5 text-xs text-[#f5f0f0]"
          >
            <button
              type="button"
              onClick={() => move(i, i - 1)}
              disabled={i === 0}
              aria-label={`${formatLabel(f)} nach vorne`}
              className="text-[#5e5858] hover:text-[#FBD00D] disabled:opacity-30 disabled:hover:text-[#5e5858]"
            >
              <ChevronLeft size={12} />
            </button>
            <span className="text-[#5e5858]">{i + 1}.</span>
            {formatLabel(f)}
            <button
              type="button"
              onClick={() => move(i, i + 1)}
              disabled={i === value.length - 1}
              aria-label={`${formatLabel(f)} nach hinten`}
              className="text-[#5e5858] hover:text-[#FBD00D] disabled:opacity-30 disabled:hover:text-[#5e5858]"
            >
              <ChevronRight size={12} />
            </button>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              aria-label={`${formatLabel(f)} entfernen`}
              className="text-[#5e5858] hover:text-[#ED1F24] ml-0.5"
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
