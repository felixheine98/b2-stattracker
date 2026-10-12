import Link from "next/link"
import { matchPath } from "@/lib/paths"
import type { HistoryMatch } from "./types"
export function OpponentHistory({ matches }: { matches: HistoryMatch[] }) {
  return <section><h2 className="mb-3 font-semibold">Matches so far ({matches.length})</h2><div className="space-y-2">{matches.map(m => {
    const body = <><span className="min-w-0"><span className="block break-words font-medium">{m.opponent ?? "Unknown"} · {m.tournamentLineup?.name ?? "Our team"}</span><span className="block text-xs text-fg-muted">{m.tournament.name}{m.date && ` · ${new Date(m.date).toLocaleDateString("de-DE")}`}</span></span><span className="shrink-0 text-sm text-fg-muted">{m.closedAt ? m.confirmedOutcome === "W" ? "Win" : m.confirmedOutcome === "L" ? "Loss" : "Draw" : "Open"}</span></>
    return m.tournamentLineup ? <Link key={m.id} href={matchPath(m.tournament, m.tournamentLineup, m)} className="flex flex-wrap justify-between gap-3 rounded-lg border border-line bg-surface p-3 hover:border-fg-subtle">{body}</Link> : <div key={m.id} className="flex flex-wrap justify-between gap-3 rounded-lg border border-line p-3">{body}</div>
  })}</div>{!matches.length && <p className="text-sm text-fg-muted">No recorded matches yet.</p>}</section>
}
