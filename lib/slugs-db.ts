import { db } from "@/lib/db"
import { matchSlugBase, slugify, uniqueSlugs } from "@/lib/slugs"
import type { SlugKind } from "@prisma/client"

// Old address parts of the lineup and match pages; no lineup may take them
const RESERVED_LINEUP_SLUGS = ["lineups", "matches"]

interface Change {
  kind: SlugKind
  scopeId: string
  id: string
  from: string | null
  to: string
}

// Bring the slugs of a tournament, its lineups and their matches in step with the current names.
// Call it after anything they follow from has changed: names, opponents, stages. A slug that is
// replaced stays behind as an alias, so old links keep working.
export async function syncTournamentSlugs(tournamentId: string): Promise<void> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      stages: true,
      tournamentLineups: {
        orderBy: { createdAt: "asc" },
        include: { matches: { orderBy: { createdAt: "asc" }, include: { stage: true } } },
      },
    },
  })
  if (!tournament) return

  const changes: Change[] = []
  const note = (kind: SlugKind, scopeId: string, id: string, from: string | null, to: string) => {
    if (from !== to) changes.push({ kind, scopeId, id, from, to })
  }

  // Older tournaments keep their slug; this one is numbered if the name is taken
  const others = await db.tournament.findMany({ where: { id: { not: tournamentId }, slug: { not: null } }, select: { slug: true } })
  const ownSlug = uniqueSlugs([{ id: tournament.id, base: slugify(tournament.name) }], others.map((t) => t.slug!), "comp").get(tournament.id)!
  note("TOURNAMENT", "", tournament.id, tournament.slug, ownSlug)

  const lineupSlugs = uniqueSlugs(
    tournament.tournamentLineups.map((l) => ({ id: l.id, base: slugify(l.name) })),
    RESERVED_LINEUP_SLUGS,
    "lineup"
  )
  for (const lineup of tournament.tournamentLineups) {
    note("LINEUP", tournament.id, lineup.id, lineup.slug, lineupSlugs.get(lineup.id)!)
    const matchSlugs = uniqueSlugs(
      lineup.matches.map((m) => ({ id: m.id, base: matchSlugBase(m.stage, tournament.stages, m.opponent) })),
      [],
      "match"
    )
    for (const match of lineup.matches) note("MATCH", lineup.id, match.id, match.slug, matchSlugs.get(match.id)!)
  }
  if (changes.length === 0) return

  const update = (c: Change, slug: string) =>
    c.kind === "TOURNAMENT" ? db.tournament.update({ where: { id: c.id }, data: { slug } })
    : c.kind === "LINEUP" ? db.tournamentLineup.update({ where: { id: c.id }, data: { slug } })
    : db.match.update({ where: { id: c.id }, data: { slug } })

  await db.$transaction([
    // Two steps, so that items swapping their slugs do not collide on the way
    ...changes.map((c) => update(c, `~${c.id}`)),
    ...changes.map((c) => update(c, c.to)),
    // An address now in use is no longer a former address of something else
    ...changes.map((c) => db.slugAlias.deleteMany({ where: { kind: c.kind, scopeId: c.scopeId, slug: c.to } })),
    ...changes
      .filter((c) => c.from && !changes.some((o) => o.kind === c.kind && o.scopeId === c.scopeId && o.to === c.from))
      .map((c) =>
        db.slugAlias.upsert({
          where: { kind_scopeId_slug: { kind: c.kind, scopeId: c.scopeId, slug: c.from! } },
          create: { kind: c.kind, scopeId: c.scopeId, slug: c.from!, targetId: c.id },
          update: { targetId: c.id },
        })
      ),
  ])
}

// Slugs are computed lazily for data that predates them
export async function ensureSlugs(): Promise<void> {
  const missing = await db.tournament.findMany({
    where: {
      OR: [
        { slug: null },
        { tournamentLineups: { some: { slug: null } } },
        { matches: { some: { slug: null, tournamentLineupId: { not: null } } } },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })
  for (const t of missing) await syncTournamentSlugs(t.id)
}

// What an address part points to: by current slug, by ID (old links), or by a former slug
async function resolve<T extends { id: string; slug: string | null }>(
  kind: SlugKind,
  scopeId: string,
  param: string,
  bySlug: () => Promise<T | null>,
  byId: (id: string) => Promise<T | null>
): Promise<T | null> {
  const direct = (await bySlug()) ?? (await byId(param))
  if (direct) return direct
  const alias = await db.slugAlias.findUnique({ where: { kind_scopeId_slug: { kind, scopeId, slug: param } } })
  return alias ? byId(alias.targetId) : null
}

export async function resolveTournament(param: string) {
  await ensureSlugs()
  return resolve(
    "TOURNAMENT",
    "",
    param,
    () => db.tournament.findUnique({ where: { slug: param }, select: { id: true, slug: true } }),
    (id) => db.tournament.findUnique({ where: { id }, select: { id: true, slug: true } })
  )
}

export async function resolveLineup(tournamentId: string, param: string) {
  return resolve(
    "LINEUP",
    tournamentId,
    param,
    () => db.tournamentLineup.findFirst({ where: { tournamentId, slug: param }, select: { id: true, slug: true } }),
    (id) => db.tournamentLineup.findFirst({ where: { id, tournamentId }, select: { id: true, slug: true } })
  )
}

export async function resolveMatch(lineupId: string, param: string) {
  return resolve(
    "MATCH",
    lineupId,
    param,
    () => db.match.findFirst({ where: { tournamentLineupId: lineupId, slug: param }, select: { id: true, slug: true } }),
    (id) => db.match.findFirst({ where: { id, tournamentLineupId: lineupId }, select: { id: true, slug: true } })
  )
}
