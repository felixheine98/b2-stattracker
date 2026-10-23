"use client"

import { FormatBuilder } from "@/components/format-builder"
import { MatchRulesFields } from "@/components/match-rules-fields"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BASE_PATH } from "@/lib/base-path"
import { draftOf, playoffBodyOf, playoffDraftOf, rulesBodyOf, type PlayoffRulesDraft, type RulesDraft } from "@/lib/match-rules-form"
import type { RuleTemplate } from "@/lib/rule-templates"
import { useSyncedState } from "@/lib/use-synced-state"
import { formatLabel } from "@/lib/utils"
import type { Format } from "@prisma/client"
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

const FLOW_LABELS: Record<string, string> = {
  ALL: "all sub-matches",
  UNTIL_DECIDED: "until decided",
  DECIDER: "decider on a tie",
}

// What a template holds, in one line: the sequence with the rounds to win, then how a match is decided
function summary(t: RuleTemplate) {
  const rounds = (format: string) => {
    const rule = t.rules.formatRules[format]
    if (!rule) return ""
    return ` to ${rule.roundsToWin}${rule.maxRounds ? ` (max ${rule.maxRounds})` : ""}`
  }
  const sequence = t.formats.map((f) => `${formatLabel(f as Format)}${rounds(f)}`).join(" · ")
  const points = t.rules.points ? ` · ${t.rules.points.win}/${t.rules.points.draw}/${t.rules.points.loss} pts` : ""
  return `${sequence} · ${FLOW_LABELS[t.rules.flow ?? ""] ?? ""}${points}${t.playoffRules ? " · own playoff rules" : ""}`
}

// Null: no dialog. An id of null: a new template.
interface Editing {
  id: string | null
  name: string
  formats: Format[]
  rules: RulesDraft
  playoffRules: PlayoffRulesDraft | null
}

export function RuleTemplatesView({ templates: initial }: { templates: RuleTemplate[] }) {
  const router = useRouter()
  const [templates, setTemplates] = useSyncedState(initial)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function open(t: RuleTemplate | null) {
    setError("")
    setEditing({
      id: t?.id ?? null,
      name: t?.name ?? "",
      formats: (t?.formats ?? []) as Format[],
      rules: draftOf(t?.rules ?? null),
      playoffRules: playoffDraftOf(t?.playoffRules ?? null),
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    setError("")
    const res = await fetch(`${BASE_PATH}/api/rule-templates${editing.id ? `/${editing.id}` : ""}`, {
      method: editing.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editing.name,
        formats: editing.formats,
        rules: rulesBodyOf(editing.rules),
        playoffRules: editing.playoffRules && playoffBodyOf(editing.playoffRules),
      }),
    })
    setSaving(false)
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Failed to save the template")
      return
    }
    setEditing(null)
    router.refresh()
  }

  async function handleDelete(t: RuleTemplate) {
    if (!confirm(`Delete the template "${t.name}"? Tournaments made from it keep their rules.`)) return
    const res = await fetch(`${BASE_PATH}/api/rule-templates/${t.id}`, { method: "DELETE" })
    if (res.ok) setTemplates((list) => list.filter((x) => x.id !== t.id))
  }

  return (
    <div className="space-y-6 page-wide">
      <div>
        <Link href="/tournaments" className="mb-3 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft size={14} />
          Tournaments
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-fg page-title">Rule templates</h1>
            <p className="text-fg-muted text-sm mt-0.5">Format sequence and match rules to start a tournament from. A tournament keeps its own copy.</p>
          </div>
          <Button onClick={() => open(null)}>
            <Plus size={16} />
            New template
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-fg-muted">No templates yet. Create one here, or use &quot;Save as template&quot; in a tournament&apos;s dialog.</p>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center gap-2 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-fg break-words">{t.name}</p>
                  <p className="text-sm text-fg-muted break-words">{summary(t)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => open(t)} aria-label={`Edit ${t.name}`} className="shrink-0 text-fg-subtle">
                  <Pencil size={14} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(t)} aria-label={`Delete ${t.name}`} className="shrink-0 text-fg-subtle hover:text-danger">
                  <Trash2 size={14} />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} className="max-w-lg">
        <DialogTitle>{editing?.id ? "Edit template" : "New template"}</DialogTitle>
        {editing && (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Name</Label>
              <Input id="template-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={60} required />
            </div>
            <div className="space-y-1.5">
              <Label>Format sequence</Label>
              <FormatBuilder value={editing.formats} onChange={(formats) => setEditing({ ...editing, formats })} />
            </div>
            <MatchRulesFields
              formats={editing.formats}
              value={editing.rules}
              onChange={(rules) => rules && setEditing({ ...editing, rules })}
              playoff={editing.playoffRules}
              onPlayoffChange={(playoffRules) => setEditing({ ...editing, playoffRules })}
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="dialog-footer flex gap-2 justify-end pt-1">
              <Button variant="ghost" type="button" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  )
}
