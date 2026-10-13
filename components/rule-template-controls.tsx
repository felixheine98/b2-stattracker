"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { BASE_PATH } from "@/lib/base-path"
import type { RuleTemplate, TemplateContent } from "@/lib/rule-templates"
import { useEffect, useState } from "react"

const endpoint = `${BASE_PATH}/api/rule-templates`

// Picks a template of format rules; its format sequence and rules are copied into the form.
// Not shown while there is no template.
export function RuleTemplateSelect({ onPick }: { onPick: (template: RuleTemplate) => void }) {
  const [templates, setTemplates] = useState<RuleTemplate[]>([])
  useEffect(() => {
    const controller = new AbortController()
    fetch(endpoint, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then(setTemplates)
      .catch(() => {})
    return () => controller.abort()
  }, [])
  if (templates.length === 0) return null
  return (
    <div className="space-y-1.5">
      <Label htmlFor="rule-template">Template <span className="text-fg-subtle">(fills formats and match rules)</span></Label>
      <Select
        id="rule-template"
        value=""
        onChange={(e) => {
          const template = templates.find((t) => t.id === e.target.value)
          if (template) onPick(template)
        }}
      >
        <option value="">Start from a template…</option>
        {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Select>
    </div>
  )
}

// Saves what is filled in as a template under a name; asks before replacing one of that name
export function SaveAsTemplateButton({ content }: { content: () => TemplateContent }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  async function save() {
    const name = prompt("Name of the template")?.trim()
    if (!name) return
    setBusy(true)
    setMessage(null)
    const send = (overwrite: boolean) =>
      fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ...content(), overwrite }) })
    let res = await send(false)
    if (res.status === 409 && confirm(`There is already a template "${name}". Replace it?`)) res = await send(true)
    setBusy(false)
    if (res.ok) setMessage({ text: `Saved as "${name}"`, error: false })
    else if (res.status !== 409) setMessage({ text: (await res.json().catch(() => null))?.error ?? "Failed to save the template", error: true })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={save} disabled={busy}>Save as template</Button>
      {message && <span className={message.error ? "text-xs text-danger" : "text-xs text-fg-muted"}>{message.text}</span>}
    </div>
  )
}
