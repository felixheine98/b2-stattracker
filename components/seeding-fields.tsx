import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { SEEDING_TYPES, isSeedingType, type SeedingChoice, type SeedingSettings } from "@/lib/seeding"

interface Props {
  value: SeedingChoice
  onChange: (choice: SeedingChoice) => void
}

const NUMBERS: Array<{ key: "maps" | "slotsPerMap" | "servers" | "rounds" | "best"; label: string }> = [
  { key: "maps", label: "Maps" },
  { key: "slotsPerMap", label: "Times per map" },
  { key: "servers", label: "Servers" },
  { key: "rounds", label: "Rounds" },
  { key: "best", label: "Best scores per map" },
]

const listOf = (text: string) => text.split(",").map((s) => s.trim()).filter(Boolean)

// How the seeding is played and scored (docs/adr/010-seeding-formate.md): without a format it stays one time attack
export function SeedingFields({ value, onChange }: Props) {
  const set = (settings: Partial<SeedingSettings>) => value && onChange({ ...value, settings: { ...value.settings, ...settings } })
  const slots = value ? value.settings.maps * value.settings.slotsPerMap : 0

  return (
    <div className="space-y-3 rounded-md border border-line p-3">
      <div className="space-y-1.5">
        <Label htmlFor="seedingType">Seeding format</Label>
        <Select
          id="seedingType"
          value={value?.type ?? ""}
          onChange={(e) => onChange(isSeedingType(e.target.value) ? { type: e.target.value, settings: { ...SEEDING_TYPES[e.target.value].defaults } } : null)}
        >
          <option value="">None (one time attack)</option>
          {Object.entries(SEEDING_TYPES).map(([type, { label }]) => <option key={type} value={type}>{label}</option>)}
        </Select>
      </div>
      {value && (
        // Keyed by type: the list fields start over with the new type's numbers
        <div key={value.type} className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {NUMBERS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`seeding-${key}`} className="text-xs text-fg-muted">{label}</Label>
                <Input
                  id={`seeding-${key}`}
                  type="number"
                  min={1}
                  value={value.settings[key]}
                  onChange={(e) => set({ [key]: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <Label htmlFor="seeding-times" className="text-xs text-fg-muted">Times, one per slot ({slots}), comma-separated</Label>
            <Input id="seeding-times" defaultValue={value.settings.times.join(", ")} onChange={(e) => set({ times: listOf(e.target.value) })} placeholder="18:00, 18:30, …" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seeding-points" className="text-xs text-fg-muted">Points per place in a round, comma-separated</Label>
            <Input
              id="seeding-points"
              defaultValue={value.settings.points.join(", ")}
              onChange={(e) => set({ points: listOf(e.target.value).map(Number).filter((n) => Number.isInteger(n) && n >= 0) })}
              placeholder="10, 6, 4, …"
            />
          </div>
          <p className="text-xs text-fg-subtle">
            {value.settings.maps * value.settings.slotsPerMap * value.settings.servers} runs per lineup; a player drives each map at most once.
          </p>
        </div>
      )}
    </div>
  )
}
