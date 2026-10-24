// Fetching a seeding master sheet from Google Sheets (docs/adr/010, question 14). Only the sheet's
// ID is taken from the link; the tabs "Seeding" and "Leagues" are exported as CSV.

export class SheetError extends Error {}

const sheetId = (url: string) => /docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)/.exec(url)?.[1] ?? null

async function text(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(15000) })
  // A sheet that is not shared answers with Google's sign-in page
  if (!res.ok || (res.headers.get("content-type") ?? "").includes("text/html") && url.includes("/export")) {
    throw new SheetError("The sheet cannot be read. Is it shared with anyone who has the link?")
  }
  return res.text()
}

export async function fetchSeedingSheet(url: string): Promise<{ seeding: string; leagues: string | null }> {
  const id = sheetId(url)
  if (!id) throw new SheetError("This is not a link to a Google sheet.")
  const base = `https://docs.google.com/spreadsheets/d/${id}`
  // The tabs by name, from the sheet's public view
  const view = await text(`${base}/htmlview`)
  const tabs = new Map([...view.matchAll(/name: "([^"]+)", pageUrl: "[^"]*?gid=(\d+)/g)].map((m) => [m[1].toLowerCase(), m[2]]))
  const seedingGid = tabs.get("seeding") ?? /[#&?]gid=(\d+)/.exec(url)?.[1]
  if (!seedingGid) throw new SheetError("The sheet has no tab “Seeding”.")
  const leaguesGid = tabs.get("leagues")
  const csv = (gid: string) => text(`${base}/export?format=csv&gid=${gid}`)
  return { seeding: await csv(seedingGid), leagues: leaguesGid ? await csv(leaguesGid) : null }
}
