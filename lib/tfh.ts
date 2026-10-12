import { load } from "cheerio"
import { z } from "zod"

export interface TfhFinish { timestamp: string; timeMs: number | null; sourceRank: number | null; sourceType: number | null }
export interface TfhDriver {
  accountId: string; name: string; checkpoints: number | null; playTimeSeconds: number | null
  cpm: number | null; bestLapMs: number | null; averageLapMs: number | null
  bestSplits: number[]; averageSplits: number[]; finishes: TfhFinish[]
}
export interface TfhTeam {
  sourceTeamId: number; name: string; tag: string; rank: number; checkpoints: number | null
  lastCpMs: number | null; roster: Array<{ accountId: string; name: string }>; drivers: TfhDriver[]
}
export interface TfhRaceData {
  sourceEventId: number; sourceUrl: string; name: string; kind: "24h" | "12h"
  mapName: string | null; startDate: string; endDate: string; selectedTeamIds: number[]; teams: TfhTeam[]
}

const count = z.number().int().nonnegative().max(2147483647)
const optionalCount = count.nullish()
const userSchema = z.object({ AccountId: z.string().uuid(), DisplayName: z.string().min(1) })
const teamSchema = z.object({
  id: count, Name: z.string().min(1), Trigram: z.string(), NumberOfCP: optionalCount, LastCPTime: optionalCount,
  Players: z.array(z.object({ User: userSchema })),
})
const detailSchema = z.object({
  Rank: count, StartDate: z.string().datetime({ offset: true }), EndDate: z.string().datetime({ offset: true }),
  Team: z.object({ id: count, Players: z.array(z.object({
    User: userSchema, NumberOfCP: optionalCount, CalculatedTotalPlayTime: optionalCount,
    CPsPerMinute: z.number().finite().nullish(), BestLap: z.string().nullish(), AverageLap: z.string().nullish(),
    Finishes: z.array(z.object({ Timestamp: z.string().datetime({ offset: true }), Time: optionalCount, Rank: optionalCount, Type: optionalCount })),
  })) }),
})

// Trackmania formatting codes are display markup, never HTML to render in our app.
export function plainTfhName(value: string): string {
  return value.replace(/\$[0-9a-f]{3}|\$[a-z<>]|\$\[[^\]]*\]/gi, "").replace(/\$\$/g, "$").trim()
}

export function tfhSourceUrl(url: string): string {
  let input: URL
  try { input = new URL(url) } catch { throw new Error("Enter a valid TFH URL.") }
  const match = input.pathname.match(/^(\/event\/(?:24h\/race|12h\/rpg)\/\d+)(?:\/(?:teams|players|team\/\d+))?\/?$/)
  if (input.origin !== "https://trackmaniaforhours.com" || input.username || input.password || !match) throw new Error("Enter a supported TFH URL (24h race or 12h RPG).")
  return `https://trackmaniaforhours.com${match[1]}/teams`
}

export async function loadTfhRace(url: string, selectedTeamIds?: number[], fetcher: typeof fetch = fetch): Promise<TfhRaceData> {
  const sourceUrl = tfhSourceUrl(url)
  const path = new URL(sourceUrl).pathname.replace(/\/teams$/, "")
  const origin = "https://trackmaniaforhours.com"
  async function request(path: string) {
    const response = await fetcher(`${origin}${path}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) })
    if (!response.ok) throw new Error("TFH data could not be loaded. Please try again.")
    return response
  }
  const html = load(await (await request(`${path}/teams`)).text())
  const header = html("[data-eventid]").first()
  const eventId = header.attr("data-eventid")
  if (!eventId || !/^\d+$/.test(eventId) || header.attr("data-eventpath") !== path || !header.text().trim()) throw new Error("The TFH event page is incomplete.")
  const sourceEventId = count.parse(Number(eventId))
  const rawTeams = z.object({ Teams: z.array(teamSchema).min(1) }).parse(await (await request(`/api/event/${sourceEventId}/teams`)).json()).Teams
  const selected = selectedTeamIds ?? rawTeams.filter(t => /(?:^|[^a-z0-9])b2/i.test(plainTfhName(t.Name)) || /^b2/i.test(plainTfhName(t.Trigram))).map(t => t.id)
  if (selectedTeamIds && !selected.length) throw new Error("Select at least one B2 team.")
  if (new Set(selected).size !== selected.length || selected.some(id => !rawTeams.some(t => t.id === id))) throw new Error("The selected teams are inconsistent with the TFH ranking.")
  if (new Set(rawTeams.map(t => t.id)).size !== rawTeams.length) throw new Error("The TFH ranking is inconsistent.")
  const teams: TfhTeam[] = rawTeams.map((t, i) => ({
    sourceTeamId: t.id, name: plainTfhName(t.Name), tag: plainTfhName(t.Trigram), rank: i + 1,
    checkpoints: t.NumberOfCP ?? null, lastCpMs: t.LastCPTime ?? null,
    roster: t.Players.map(p => ({ accountId: p.User.AccountId.toLowerCase(), name: plainTfhName(p.User.DisplayName) })), drivers: [],
  }))
  let startDate = "", endDate = ""
  const split = (value?: string | null): number[] => value ? value.split(",").map(v => count.parse(Number(v))) : []
  for (const id of selected.length ? selected : [rawTeams[0].id]) {
    const detail = detailSchema.parse(await (await request(`/api/event/${sourceEventId}/team/${id}`)).json())
    const team = teams.find(t => t.sourceTeamId === id)!
    if (detail.Team.id !== id || detail.Rank !== team.rank || (startDate && (Date.parse(startDate) !== Date.parse(detail.StartDate) || Date.parse(endDate) !== Date.parse(detail.EndDate)))) throw new Error("The TFH team data is inconsistent. Please reload the preview.")
    startDate = detail.StartDate; endDate = detail.EndDate
    if (Date.parse(endDate) >= Date.now() || Date.parse(startDate) >= Date.parse(endDate)) throw new Error("Only finished TFH races can be imported.")
    const accounts = detail.Team.Players.map(p => p.User.AccountId.toLowerCase())
    if (new Set(accounts).size !== accounts.length || accounts.length !== team.roster.length || team.roster.some(p => !accounts.includes(p.accountId))) throw new Error(`The TFH player data for ${team.name} is incomplete.`)
    if (!selected.includes(id)) continue
    team.drivers = detail.Team.Players.map(p => {
      const bestSplits = split(p.BestLap), averageSplits = split(p.AverageLap)
      return {
        accountId: p.User.AccountId.toLowerCase(), name: plainTfhName(p.User.DisplayName), checkpoints: p.NumberOfCP ?? null,
        playTimeSeconds: p.CalculatedTotalPlayTime ?? null, cpm: p.CPsPerMinute && p.CPsPerMinute > 0 ? p.CPsPerMinute : null,
        bestLapMs: bestSplits.at(-1) || null, averageLapMs: averageSplits.at(-1) || null, bestSplits, averageSplits,
        finishes: p.Finishes.map(f => ({ timestamp: f.Timestamp, timeMs: f.Time ?? null, sourceRank: f.Rank ?? null, sourceType: f.Type ?? null })),
      }
    })
  }
  return { sourceEventId, sourceUrl, name: plainTfhName(header.text()), kind: path.includes("24h") ? "24h" : "12h", mapName: plainTfhName(html("[data-mptext]").first().attr("data-mptext") ?? "") || null, startDate, endDate, selectedTeamIds: selected, teams }
}
