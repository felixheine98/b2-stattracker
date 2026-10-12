import Link from "next/link"
import { lineupPath } from "@/lib/paths"
import { formatDay } from "@/lib/player-status"
import { formatTime } from "@/lib/utils"
import { formatTfhDuration, summarizeTfhProfile } from "@/lib/tfh-profile"
import type { Prisma } from "@prisma/client"

type Result = Prisma.TfhDriverGetPayload<{ include: { team: { include: { lineup: true; race: { include: { tournament: true } } } } } }>

export function TfhPlayerSection({ results }: { results: Result[] }) {
  if (!results.length) return null
  const summary = summarizeTfhProfile(results.map(r => ({ raceId: r.team.raceId, playTimeSeconds: r.playTimeSeconds })))
  return <section className="min-w-0 space-y-3">
    <h2 className="text-lg font-semibold">TFH endurance</h2>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="rounded-xl border border-line bg-surface p-4"><p className="text-xs text-fg-muted">Participations</p><p className="mt-1 text-xl font-semibold">{summary.participations}</p></div><div className="rounded-xl border border-line bg-surface p-4"><p className="text-xs text-fg-muted">{summary.missingPlayTimes ? "Recorded play time" : "Total play time"}</p><p className="mt-1 text-xl font-semibold">{summary.missingPlayTimes === results.length ? "—" : formatTfhDuration(summary.playTimeSeconds)}</p>{summary.missingPlayTimes > 0 && <p className="mt-1 text-xs text-fg-muted">Play time missing for {summary.missingPlayTimes} result(s).</p>}</div></div>
    <p className="text-xs text-fg-muted">CPM and lap times are compared within each race. TFH results have their own statistics.</p>
    <div className="overflow-x-auto rounded-lg border border-line"><table className="w-full bg-table-row text-xs">
      <thead className="bg-table-head text-fg-muted"><tr><th className="sticky left-0 z-[1] bg-table-head px-3 py-2 text-left">Race / lineup</th>{["Date", "Team rank", "CP", "Play time", "CPM", "Best lap", "Average lap"].map(h => <th key={h} className="whitespace-nowrap px-3 py-2 text-right">{h}</th>)}</tr></thead>
      <tbody>{results.map(r => <tr key={r.id} className="border-t border-table-rule"><td className="sticky left-0 z-[1] bg-table-cell px-3 py-2 text-left max-md:shadow-[1px_0_0_var(--border)]"><Link href={lineupPath(r.team.race.tournament, r.team.lineup!)} className="block max-w-40 truncate text-brand-ink hover:underline sm:max-w-64" title={r.team.race.tournament.name}>{r.team.race.tournament.name}</Link><span className="block max-w-40 truncate text-fg-muted">{r.team.name}</span></td>{[
        r.team.race.tournament.startDate ? formatDay(r.team.race.tournament.startDate) : "—", `#${r.team.rank}`, r.checkpoints ?? "—", formatTfhDuration(r.playTimeSeconds), r.cpm?.toFixed(3) ?? "—", r.bestLapMs === null ? "—" : formatTime(r.bestLapMs), r.averageLapMs === null ? "—" : formatTime(r.averageLapMs),
      ].map((value, i) => <td key={i} className="whitespace-nowrap px-3 py-2 text-right">{value}</td>)}</tr>)}</tbody>
    </table></div>
  </section>
}
