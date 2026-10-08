// Server-side access to the public trackmania.io API (player search and player lookup).
// The API is run by the Openplanet community: every request must identify the application
// and a contact, and usage is limited to 40 requests per minute.
import { countryCodeByName } from "@/lib/countries"

const API = "https://trackmania.io/api"
const USER_AGENT = process.env.TMIO_USER_AGENT || "B2 Stats (reh-netsolutions.cc/b2-stats)"
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export interface TmioPlayer {
  id: string
  name: string
  clubTag: string | null
  // Our lower-case country code, or null if trackmania.io reports no known country
  country: string | null
  countryName: string | null
  region: string | null
}

export class TmioError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

interface Zone {
  name: string
  parent?: Zone | null
}

// Zones nest as region(s) -> country -> continent -> World, so the country is third from the top
function readZone(zone: Zone | null | undefined) {
  const chain: string[] = []
  for (let z = zone; z; z = z.parent) chain.push(z.name)
  const countryName = chain.length >= 3 ? chain[chain.length - 3] : null
  return {
    countryName,
    country: countryName ? countryCodeByName(countryName) : null,
    region: chain.length >= 4 ? chain[0] : null,
  }
}

// Club tags carry Trackmania formatting codes such as $S, $FFF or $l[...]
function plainTag(tag: string | null | undefined): string | null {
  const text = (tag ?? "").replace(/\$(\$|[0-9a-f]{3}|[lhp]\[[^\]]*\]|.)/gi, (_, code) => (code === "$" ? "$" : "")).trim()
  return text || null
}

async function request(path: string): Promise<Response> {
  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new TmioError("trackmania.io is not reachable", 502)
  }
  if (res.status === 429) throw new TmioError("trackmania.io request limit reached, try again in a minute", 429)
  return res
}

// Player by account ID, or null if trackmania.io does not know the ID
export async function fetchTmioPlayer(id: string): Promise<TmioPlayer | null> {
  const res = await request(`/player/${encodeURIComponent(id)}`)
  // Unknown IDs are answered with status 500 and { error: "account not found" }.
  // Any other failure (an outage, an HTML error page) must not be read as "not found".
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const reason = typeof body?.error === "string" ? body.error.toLowerCase() : ""
    if (res.status === 404 || reason === "account not found" || reason === "invalid account id") return null
    throw new TmioError("trackmania.io returned an error", 502)
  }
  const data = await res.json().catch(() => null)
  if (!data?.accountid || !data.displayname) throw new TmioError("trackmania.io returned an unreadable answer", 502)
  return { id: data.accountid, name: data.displayname, clubTag: plainTag(data.clubtag), ...readZone(data.trophies?.zone) }
}

// Search by name, or resolve a pasted account ID / trackmania.io link to exactly one player
export async function searchTmioPlayers(query: string): Promise<TmioPlayer[]> {
  const id = UUID.exec(query)?.[0]
  if (id) {
    const player = await fetchTmioPlayer(id.toLowerCase())
    return player ? [player] : []
  }
  const res = await request(`/players/find?search=${encodeURIComponent(query.trim())}`)
  if (!res.ok) throw new TmioError("trackmania.io returned an error", 502)
  const data = await res.json().catch(() => null)
  if (!Array.isArray(data)) throw new TmioError("trackmania.io returned an unreadable answer", 502)
  return data
    .map((entry) => entry?.player)
    .filter((p) => p?.id && p.name)
    .map((p) => ({ id: p.id, name: p.name, clubTag: plainTag(p.tag), ...readZone(p.zone) }))
}
