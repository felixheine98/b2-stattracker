// The style of a tournament: the driving style that marks it as a whole. Every tournament has
// exactly one, from this fixed list (see docs/adr/002-comp-styles.md).
import type { CompStyle } from "@prisma/client"

// In the order they are offered and listed
export const STYLE_ORDER: CompStyle[] = ["TECH", "FULLSPEED", "DIRT", "ICE", "RPG", "ENDURANCE", "MIXED"]

// The style named in the address (?style=ice), null for none or an unknown one
export function parseStyle(param: string | string[] | undefined): CompStyle | null {
  if (typeof param !== "string") return null
  return STYLE_ORDER.find((style) => style === param.toUpperCase()) ?? null
}

const LABELS: Record<CompStyle, string> = {
  TECH: "Tech",
  FULLSPEED: "Fullspeed",
  DIRT: "Dirt",
  ICE: "Ice",
  RPG: "RPG",
  ENDURANCE: "Endurance",
  MIXED: "Mixed",
}

export const styleLabel = (style: CompStyle): string => LABELS[style]

// How the style is written in the address
export const styleParam = (style: CompStyle): string => style.toLowerCase()

// The styles that have at least one of the tournaments; only these are offered as a filter
export function stylesInUse(tournaments: Array<{ style: CompStyle }>): CompStyle[] {
  return STYLE_ORDER.filter((style) => tournaments.some((t) => t.style === style))
}

// The tournaments of a style; all of them without one
export function filterByStyle<T extends { style: CompStyle }>(tournaments: T[], style: CompStyle | null): T[] {
  return style ? tournaments.filter((t) => t.style === style) : tournaments
}

// An endurance race is not driven in rounds, so it has no formats; every other tournament
// needs at least one to enter matches
export const needsFormats = (style: CompStyle): boolean => style !== "ENDURANCE"
