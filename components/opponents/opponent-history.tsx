import Link from "next/link"
import { matchPath } from "@/lib/paths"
import type { HistoryMatch } from "./types"
export function OpponentHistory({ matches }: { matches: HistoryMatch[] }) {
  return <section><h2 className="mb-3 font-semibold">Bisherige Begegnungen ({matches.length})</h2><div className="space-y-2">{matches.map(m => {
    const body = <><span className="min-w-0"><span className="block break-words font-medium">{m.opponent ?? "Unbekannt"} · {m.tournamentLineup?.name ?? "Unser Team"}</span><span className="block text-xs text-[#9a9090]">{m.tournament.name}{m.date && ` · ${new Date(m.date).toLocaleDateString("de-DE")}`}</span></span><span className="shrink-0 text-sm text-[#9a9090]">{m.closedAt ? m.confirmedOutcome === "W" ? "Sieg" : m.confirmedOutcome === "L" ? "Niederlage" : "Unentschieden" : "Offen"}</span></>
    return m.tournamentLineup ? <Link key={m.id} href={matchPath(m.tournament, m.tournamentLineup, m)} className="flex flex-wrap justify-between gap-3 rounded-lg border border-[#2d2829] bg-[#1c1819] p-3 hover:border-[#5e5858]">{body}</Link> : <div key={m.id} className="flex flex-wrap justify-between gap-3 rounded-lg border border-[#2d2829] p-3">{body}</div>
  })}</div>{!matches.length && <p className="text-sm text-[#9a9090]">Noch keine erfassten Begegnungen.</p>}</section>
}
