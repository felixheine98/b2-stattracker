import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { StagePlan } from "@/lib/stages"

interface Props {
  value: StagePlan
  onChange: (plan: StagePlan) => void
}

// How a tournament is divided: seeding yes/no, number of match days and of playoff days
export function StagePlanFields({ value, onChange }: Props) {
  return (
    <div className="space-y-1.5">
      <Label>Aufbau</Label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex h-9 items-center gap-2 rounded-md border border-[#3a3435] bg-[#251f20] px-3 text-sm text-[#f5f0f0]">
          <input
            type="checkbox"
            checked={value.seeding}
            onChange={(e) => onChange({ ...value, seeding: e.target.checked })}
            className="accent-[#FBD00D]"
          />
          Seeding
        </label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={20}
            value={value.matchDays}
            onChange={(e) => onChange({ ...value, matchDays: Math.max(1, Number(e.target.value) || 1) })}
            aria-label="Anzahl Match Days"
            className="w-16"
          />
          <span className="text-xs text-[#9a9090]">Match Days</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={10}
            value={value.playoffDays}
            onChange={(e) => onChange({ ...value, playoffDays: Math.max(0, Number(e.target.value) || 0) })}
            aria-label="Anzahl Playoff-Tage"
            className="w-16"
          />
          <span className="text-xs text-[#9a9090]">Playoff-Tage</span>
        </div>
      </div>
      <p className="text-xs text-[#5e5858]">
        Das Startdatum ist der Tag {value.seeding ? "des Seedings" : "von Match Day 1"}, jeder weitere Abschnitt folgt eine Woche später.
      </p>
    </div>
  )
}
