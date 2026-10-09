// Readable address parts ("slugs") for tournaments, lineups and matches. They always follow
// from the names: /tournaments/vertigo-s1/b2-esports/md1-vs-onyx-white
import type { StageType } from "./stages"

// Lower case, umlauts written out, everything but letters and digits turned into hyphens
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// One slug per item, in the given order: the first item with a name keeps it, later ones are
// numbered (-2, -3, ...). Reserved slugs are never handed out; an empty name becomes the fallback.
export function uniqueSlugs(items: Array<{ id: string; base: string }>, reserved: string[] = [], fallback = "x"): Map<string, string> {
  const taken = new Set(reserved)
  // A name that already looks numbered ("x-2") keeps its slug, so numbering works around it
  const plainCount = new Map<string, number>()
  for (const item of items) plainCount.set(item.base, (plainCount.get(item.base) ?? 0) + 1)
  const fixed = new Set(items.filter((i) => plainCount.get(i.base) === 1 && !reserved.includes(i.base || fallback)).map((i) => i.base || fallback))

  const slugs = new Map<string, string>()
  for (const item of items) {
    const base = item.base || fallback
    let slug = base
    for (let n = 2; taken.has(slug) || (slug !== base && fixed.has(slug)); n++) slug = `${base}-${n}`
    taken.add(slug)
    slugs.set(item.id, slug)
  }
  return slugs
}

// A match is addressed by its stage and opponent: md1-vs-onyx-white, playoffs-vs-ocd, seeding
export function matchSlugBase(
  stage: { type: StageType; number: number },
  stages: Array<{ type: StageType }>,
  opponent: string | null | undefined
): string {
  if (stage.type === "SEEDING") return "seeding"
  const part =
    stage.type === "GROUP" ? `md${stage.number}`
    : stages.filter((s) => s.type === "PLAYOFF").length > 1 ? `playoffs-${stage.number}` : "playoffs"
  const versus = slugify(opponent ?? "")
  return versus ? `${part}-vs-${versus}` : part
}
