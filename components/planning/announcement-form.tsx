"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { AtSign, Plus, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { announcementText, checkEmojis, emojiLegend, insertAt, searchEmojis, type EmojiChoice, type ServerEmoji } from "@/lib/matchday-discord"
import { compRoles, playerMention, roleMention, searchRoles, toDiscordMentions, type Mention, type ServerRole } from "@/lib/discord-mentions"
import type { MatchdayAnswer } from "@/lib/matchday-plan"

// The announcement the bot posts (docs/adr/008): which emojis it sets and what each means, chosen
// by clicking instead of copying, and the text, which offers to name them and to mention roles and
// players. The text shows mentions as @names; they become Discord's mentions when posting.

const ANSWERS: Array<{ value: MatchdayAnswer; label: string }> = [
  { value: "FIX", label: "Fix" },
  { value: "PARTIAL", label: "Partly" },
  { value: "MAYBE", label: "Maybe" },
  { value: "OUT", label: "Out" },
]

// A Unicode emoji as it is, one of the server's from Discord's CDN
export function EmojiView({ choice, size = 18 }: { choice: { key: string; text: string; imageUrl?: string }; size?: number }) {
  if (choice.key.startsWith("custom:")) {
    const animated = choice.text.startsWith("<a:")
    const src = choice.imageUrl ?? `https://cdn.discordapp.com/emojis/${choice.key.slice(7)}.${animated ? "gif" : "png"}`
    return <Image src={src} alt={choice.text} title={choice.text} width={size} height={size} unoptimized className="inline-block" />
  }
  return <span style={{ fontSize: size * 0.9 }} className="leading-none">{choice.text}</span>
}

// What the announcement can mention
export interface Mentionable {
  roles: ServerRole[]
  // Whether the bot may ping roles that are not mentionable in the lineup channel
  mentionAll: boolean
  rolesError?: string
  comp: string
  lineup: string
  players: Array<{ id: string; name: string; discordUserId: string }>
}

interface Props extends Mentionable {
  stage: string
  day: string
  server: ServerEmoji[]
  lastUsed: EmojiChoice[]
  busy: boolean
  onPost: (text: string, emojis: EmojiChoice[]) => void
  onCancel: () => void
}

export function AnnouncementForm({ stage, day, server, lastUsed, busy, onPost, onCancel, roles, mentionAll, rolesError, comp, lineup, players }: Props) {
  const [choices, setChoices] = useState<EmojiChoice[]>(lastUsed)
  const [text, setText] = useState(() => announcementText(stage, new Date(day), lastUsed))
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState("")
  // The mention picker open below the text, and the mentions inserted so far
  const [mentioning, setMentioning] = useState<"role" | "player" | null>(null)
  const [roleQuery, setRoleQuery] = useState("")
  const [allRoles, setAllRoles] = useState(false)
  const [mentions, setMentions] = useState<Mention[]>([])
  const field = useRef<HTMLTextAreaElement>(null)
  const problem = checkEmojis(choices)

  // While the text is still the offered one, it follows the chosen emojis
  function changeChoices(next: EmojiChoice[]) {
    if (text === announcementText(stage, new Date(day), choices)) setText(announcementText(stage, new Date(day), next))
    setChoices(next)
  }

  function pick(emoji: { key: string; text: string }) {
    if (choices.some((c) => c.key === emoji.key)) return
    // A new emoji stands for the first answer no emoji has yet
    const answer = ANSWERS.find((a) => !choices.some((c) => c.answer === a.value))?.value ?? "FIX"
    changeChoices([...choices, { key: emoji.key, text: emoji.text, answer }])
    setPicking(false)
    setQuery("")
  }

  // An emoji or the legend at the cursor
  function insert(value: string) {
    const el = field.current
    if (!el) return
    const next = insertAt(text, el.selectionStart, el.selectionEnd, value)
    setText(next.text)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(next.cursor, next.cursor) })
  }

  function mention(added: Mention[]) {
    insert(added.map((m) => m.label).join(" ") + " ")
    setMentions((old) => [...old, ...added.filter((m) => !old.some((o) => o.label === m.label))])
    setMentioning(null)
    setRoleQuery("")
  }

  const found = picking ? searchEmojis(query, server) : []
  const forComp = compRoles(roles, comp, lineup)
  const shownRoles = roleQuery.trim() || allRoles || forComp.length === 0 ? searchRoles(roleQuery, roles) : forComp

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!problem) onPost(toDiscordMentions(text, mentions), choices) }}>
      <div className="space-y-1.5">
        <p className="text-xs text-fg-soft">The emojis the bot sets under it, and what a reaction with each means:</p>
        {choices.map((choice, i) => (
          <div key={choice.key} className="flex items-center gap-2">
            <span className="flex h-8 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-raised"><EmojiView choice={choice} /></span>
            <Select aria-label={`Answer for ${choice.text}`} className="h-8 flex-1 text-sm" value={choice.answer} disabled={busy}
              onChange={(e) => changeChoices(choices.map((c, j) => (j === i ? { ...c, answer: e.target.value as MatchdayAnswer } : c)))}>
              {ANSWERS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </Select>
            <button type="button" aria-label={`Remove ${choice.text}`} disabled={busy} onClick={() => changeChoices(choices.filter((_, j) => j !== i))}
              className="rounded-md p-1.5 text-fg-subtle hover:bg-raised hover:text-fg">
              <X size={14} />
            </button>
          </div>
        ))}
        {!picking ? (
          <Button type="button" size="sm" variant="ghost" disabled={busy || choices.length >= 10} onClick={() => setPicking(true)}>
            <Plus size={14} /> Add emoji
          </Button>
        ) : (
          <div className="space-y-2 rounded-lg border border-line p-2">
            <div className="flex gap-2">
              <Input autoFocus aria-label="Find an emoji" placeholder="Find an emoji, e.g. check, clock, b2…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 text-sm" />
              <Button type="button" size="sm" variant="ghost" onClick={() => { setPicking(false); setQuery("") }}>Done</Button>
            </div>
            <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
              {found.map((emoji) => {
                const chosen = choices.some((c) => c.key === emoji.key)
                return (
                  <button key={emoji.key} type="button" title={emoji.name} aria-label={`Add ${emoji.name}`} disabled={chosen} onClick={() => pick(emoji)}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-transparent hover:border-line-strong hover:bg-raised disabled:opacity-30">
                    <EmojiView choice={emoji} size={22} />
                  </button>
                )
              })}
              {found.length === 0 && <p className="px-1 py-2 text-xs text-fg-muted">No emoji found.</p>}
            </div>
          </div>
        )}
      </div>

      <label className="block text-xs text-fg-soft">
        The text the bot posts in the lineup channel. Mention a role or players to ping them.
        <Textarea ref={field} className="mt-1" rows={3} value={text} maxLength={2000} required disabled={busy} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Insert">
        {choices.map((choice) => (
          <button key={choice.key} type="button" title={`Insert ${choice.text}`} aria-label={`Insert ${choice.text}`} disabled={busy} onClick={() => insert(choice.text)}
            className="flex h-8 min-w-8 items-center justify-center rounded-md border border-line bg-raised px-1.5 hover:border-line-strong">
            <EmojiView choice={choice} />
          </button>
        ))}
        <button type="button" disabled={busy || choices.length === 0} onClick={() => insert(emojiLegend(choices))}
          className="rounded-md border border-line bg-raised px-2 py-1.5 text-xs text-fg-soft hover:border-line-strong hover:text-fg">
          Insert legend
        </button>
        <button type="button" disabled={busy} onClick={() => setMentioning(mentioning === "role" ? null : "role")}
          className="flex items-center gap-1 rounded-md border border-line bg-raised px-2 py-1.5 text-xs text-fg-soft hover:border-line-strong hover:text-fg">
          <AtSign size={12} /> Role
        </button>
        <button type="button" disabled={busy} onClick={() => setMentioning(mentioning === "player" ? null : "player")}
          className="flex items-center gap-1 rounded-md border border-line bg-raised px-2 py-1.5 text-xs text-fg-soft hover:border-line-strong hover:text-fg">
          <Users size={12} /> Players
        </button>
      </div>

      {mentioning === "role" && (
        <div className="space-y-2 rounded-lg border border-line p-2">
          <div className="flex gap-2">
            <Input autoFocus aria-label="Find a role" placeholder="Find a role…" value={roleQuery} onChange={(e) => setRoleQuery(e.target.value)} className="h-8 text-sm" />
            <Button type="button" size="sm" variant="ghost" onClick={() => { setMentioning(null); setRoleQuery("") }}>Done</Button>
          </div>
          {rolesError ? <p className="text-xs text-danger">{rolesError}</p> : (
            <>
              {!roleQuery.trim() && forComp.length > 0 && (
                <p className="text-xs text-fg-muted">
                  {allRoles ? "All roles" : `Roles for ${comp}`} ·{" "}
                  <button type="button" className="underline-offset-2 hover:underline" onClick={() => setAllRoles(!allRoles)}>{allRoles ? `only ${comp}` : "all roles"}</button>
                </p>
              )}
              <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
                {shownRoles.map((role) => (
                  <button key={role.id} type="button" onClick={() => mention([roleMention(role)])}
                    title={!role.mentionable && !mentionAll ? "Does not ping: the bot may not mention this role in the lineup channel" : undefined}
                    className={`flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs hover:border-line-strong hover:bg-raised ${!role.mentionable && !mentionAll ? "text-fg-subtle" : "text-fg-soft"}`}>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-fg-subtle" style={role.color ? { background: role.color } : undefined} />
                    @{role.name}
                  </button>
                ))}
                {shownRoles.length === 0 && <p className="px-1 py-2 text-xs text-fg-muted">No role found.</p>}
              </div>
              {!mentionAll && shownRoles.some((r) => !r.mentionable) && (
                <p className="text-xs text-fg-muted">Greyed roles do not ping: they are not mentionable, and the bot may not mention all roles in the lineup channel (Discord permission „Mention @everyone, @here and All Roles“).</p>
              )}
            </>
          )}
        </div>
      )}

      {mentioning === "player" && (
        <div className="space-y-2 rounded-lg border border-line p-2">
          {players.length === 0 ? <p className="text-xs text-fg-muted">No player of the kader has a linked Discord account.</p> : (
            <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
              <button type="button" onClick={() => mention(players.map((p) => playerMention(p.name, p.discordUserId)))}
                className="rounded-md border border-line-strong px-2 py-1 text-xs font-medium text-fg-soft hover:bg-raised">
                Whole kader ({players.length})
              </button>
              {players.map((p) => (
                <button key={p.id} type="button" onClick={() => mention([playerMention(p.name, p.discordUserId)])}
                  className="rounded-md border border-line px-2 py-1 text-xs text-fg-soft hover:border-line-strong hover:bg-raised">
                  @{p.name}
                </button>
              ))}
            </div>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={() => setMentioning(null)}>Done</Button>
        </div>
      )}

      {problem && <p className="text-xs text-danger">{problem}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy || !text.trim() || !!problem}>{busy ? "Posting…" : "Post"}</Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
