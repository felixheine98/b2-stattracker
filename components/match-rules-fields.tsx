import { FormatBuilder } from "@/components/format-builder"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { ruledFormats } from "@/lib/match-rules"
import { draftOf, type PlayoffRulesDraft, type RulesDraft } from "@/lib/match-rules-form"
import { formatLabel } from "@/lib/utils"
import type { Format } from "@prisma/client"

const FLOWS = [
  { value: "ALL", label: "All sub-matches are played" },
  { value: "UNTIL_DECIDED", label: "Until decided (best of)" },
  { value: "DECIDER", label: "Last sub-match is a decider on a tie" },
]

interface RuleSetProps<T extends RulesDraft> {
  // Prefix of the field ids, so two sets can stand in one dialog
  id: string
  formats: string[]
  value: T
  onChange: (value: T) => void
  points: boolean
}

// The fields of one rule set: how a match is decided, a row per format, and the points
function RuleSetFields<T extends RulesDraft>({ id, formats, value, onChange, points }: RuleSetProps<T>) {
  const rows = [...new Set(ruledFormats(formats))]
  const rule = (format: string) => value.formatRules[format] ?? { roundsToWin: "", maxRounds: "" }
  const setRule = (format: string, change: Partial<RulesDraft["formatRules"][string]>) =>
    onChange({ ...value, formatRules: { ...value.formatRules, [format]: { ...rule(format), ...change } } })

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-flow`}>A match is decided</Label>
        <Select id={`${id}-flow`} value={value.flow} onChange={(e) => onChange({ ...value, flow: e.target.value })}>
          <option value="" disabled>Select…</option>
          {FLOWS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </Select>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-fg-subtle">Add formats to the sequence to enter their rules.</p>
      ) : (
        <div className="grid grid-cols-[3rem_1fr_1fr] items-center gap-x-3 gap-y-1.5">
          <span />
          <span className="text-xs text-fg-muted">Rounds to win</span>
          <span className="text-xs text-fg-muted">Max rounds <span className="text-fg-subtle">(optional)</span></span>
          {rows.map((format) => (
            <div key={format} className="contents">
              <span className="text-sm text-fg">{formatLabel(format as Format)}</span>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={rule(format).roundsToWin}
                onChange={(e) => setRule(format, { roundsToWin: e.target.value })}
                aria-label={`Rounds to win in ${formatLabel(format as Format)}`}
              />
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={rule(format).maxRounds}
                onChange={(e) => setRule(format, { maxRounds: e.target.value })}
                placeholder="no limit"
                aria-label={`Max rounds in ${formatLabel(format as Format)}`}
              />
            </div>
          ))}
        </div>
      )}
      {points && (
        <div className="space-y-1.5">
          <Label>Points for a group match</Label>
          <div className="grid grid-cols-3 gap-3">
            {(["win", "draw", "loss"] as const).map((key) => (
              <div key={key} className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={value.points[key]}
                  onChange={(e) => onChange({ ...value, points: { ...value.points, [key]: e.target.value } })}
                  aria-label={`Points for a ${key}`}
                />
                <span className="text-xs capitalize text-fg-muted">{key}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  // The format sequence of the tournament
  formats: Format[]
  // Null: the tournament has no rules. Only a tournament from before the rules may stay that way.
  value: RulesDraft | null
  onChange: (value: RulesDraft | null) => void
  // Null: the playoffs follow the rules of the competition
  playoff: PlayoffRulesDraft | null
  onPlayoffChange: (value: PlayoffRulesDraft | null) => void
}

// How the matches of a tournament are played and decided (docs/adr/005-comp-formatregeln.md).
// Stands below the format sequence, whose formats it gives a row each.
export function MatchRulesFields({ formats, value, onChange, playoff, onPlayoffChange }: Props) {
  if (ruledFormats(formats).length === 0) return null
  if (!value) {
    return (
      <div className="space-y-1.5">
        <Label>Match rules</Label>
        <p className="text-xs text-fg-subtle">This tournament has no rules yet, so its matches show neither hints nor points.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(draftOf(null))}>Add match rules</Button>
      </div>
    )
  }
  return (
    <div className="space-y-3 rounded-lg border border-line p-3">
      <Label>Match rules</Label>
      <RuleSetFields id="rules" formats={formats} value={value} onChange={onChange} points />
      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          checked={playoff !== null}
          onChange={(e) => onPlayoffChange(e.target.checked ? { ...draftOf(null), formats: ruledFormats(formats) } : null)}
          className="accent-brand"
        />
        The playoffs have rules of their own
      </label>
      {playoff && (
        <div className="space-y-3 border-t border-line pt-3">
          <div className="space-y-1.5">
            <Label>Playoff format sequence</Label>
            <FormatBuilder value={playoff.formats as Format[]} onChange={(f) => onPlayoffChange({ ...playoff, formats: f })} />
          </div>
          <RuleSetFields id="playoff-rules" formats={playoff.formats} value={playoff} onChange={onPlayoffChange} points={false} />
        </div>
      )}
    </div>
  )
}
