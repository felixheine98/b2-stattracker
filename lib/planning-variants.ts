// Lineup variants of a planning: complete proposals built from the availability list
import type { Answer } from "./planning"

export interface VariantLineup {
  id: string
  name: string
  note: string | null
  playerIds: string[]
}

export interface VariantData {
  id: string
  name: string
  note: string | null
  lineups: VariantLineup[]
  // Remarks on players in this variant, by player ID, e.g. "only if X cancels". A note stays
  // with the player wherever they are moved, also back to the pool.
  playerNotes: Record<string, string>
  // Managers who gave this variant their thumbs-up
  votes: Array<{ userId: string; name: string }>
}

interface Row<P> {
  player: P
  answer: Answer
}

// What a variant looks like on the board: the pool of players still to place, and the lineups.
// Whoever answered "not in" is not offered in the pool; if such a player is already placed,
// they stay where they are and are flagged, so the gap is visible.
export function variantBoard<P extends { id: string }, R extends Row<P>>(variant: VariantData, rows: R[]) {
  const byId = new Map(rows.map((r) => [r.player.id, r]))
  const placed = new Set(variant.lineups.flatMap((l) => l.playerIds))
  const noteOf = (playerId: string) => variant.playerNotes[playerId] ?? null
  const lineups = variant.lineups.map((lineup) => ({
    ...lineup,
    players: lineup.playerIds.flatMap((playerId) => {
      const row = byId.get(playerId)
      return row ? [{ ...row, note: noteOf(playerId), out: row.answer === "OUT" }] : []
    }),
  }))
  return {
    pool: rows.filter((r) => r.answer !== "OUT" && !placed.has(r.player.id)).map((r) => ({ ...r, note: noteOf(r.player.id) })),
    lineups,
    outCount: lineups.reduce((sum, l) => sum + l.players.filter((p) => p.out).length, 0),
  }
}

// What adopting a variant creates in the tournament: one lineup per variant lineup that has
// players, as the board shows them. Empty lineups are left out; whoever is not placed stays without.
export function adoptionPlan<P extends { id: string }, R extends Row<P>>(variant: VariantData, rows: R[]) {
  const board = variantBoard(variant, rows)
  const filled = board.lineups.filter((l) => l.players.length > 0)
  return {
    lineups: filled.map((l) => ({ name: l.name, playerIds: l.players.map((p) => p.player.id) })),
    empty: board.lineups.filter((l) => l.players.length === 0).map((l) => l.name),
    outCount: board.outCount,
    unplaced: board.pool.length,
  }
}

// Name for a new variant, or for a copy of the one called copyOf
export function nextVariantName(existing: string[], copyOf?: string): string {
  if (!copyOf) return `Variant ${existing.length + 1}`
  let name = `${copyOf} (copy)`
  for (let n = 2; existing.includes(name); n++) name = `${copyOf} (copy ${n})`
  return name
}

// The usual lineups by how many there are: with two it is eSports and Academy, the third is Rising,
// the fourth Horizon. They are listed in their order of rank; the names can be changed afterwards.
const LINEUPS_BY_COUNT = ["B2 eSports", "B2 Academy", "B2 Rising", "B2 Horizon"]
const LINEUP_RANK = ["B2 eSports", "B2 Rising", "B2 Academy", "B2 Horizon"]

export function defaultLineupNames(count: number): string[] {
  const usual = LINEUPS_BY_COUNT.slice(0, count)
  return [
    ...LINEUP_RANK.filter((name) => usual.includes(name)),
    ...Array.from({ length: Math.max(0, count - LINEUPS_BY_COUNT.length) }, (_, i) => `Lineup ${LINEUPS_BY_COUNT.length + i + 1}`),
  ]
}

// Changes to variants. The server applies them to the database; the board applies the frequent
// ones to its own copy at once (applyAction), so moving a player does not wait for the server.
export type VariantAction =
  | { type: "createVariant"; copyFrom?: string; lineupCount?: number }
  | { type: "updateVariant"; variantId: string; name?: string; note?: string | null }
  | { type: "deleteVariant"; variantId: string }
  | { type: "addLineup"; variantId: string; name: string }
  | { type: "updateLineup"; lineupId: string; name?: string; note?: string | null }
  | { type: "deleteLineup"; lineupId: string }
  | { type: "placePlayer"; variantId: string; playerId: string; lineupId: string | null }
  | { type: "notePlayer"; variantId: string; playerId: string; note: string | null }
  | { type: "vote"; variantId: string; on: boolean }

export function applyAction(variants: VariantData[], action: VariantAction): VariantData[] {
  switch (action.type) {
    case "placePlayer":
      return variants.map((v) => {
        if (v.id !== action.variantId) return v
        return {
          ...v,
          lineups: v.lineups.map((l) => {
            const playerIds = l.playerIds.filter((id) => id !== action.playerId)
            return { ...l, playerIds: l.id === action.lineupId ? [...playerIds, action.playerId] : playerIds }
          }),
        }
      })
    case "notePlayer":
      return variants.map((v) => {
        if (v.id !== action.variantId) return v
        const playerNotes = { ...v.playerNotes }
        if (action.note) playerNotes[action.playerId] = action.note
        else delete playerNotes[action.playerId]
        return { ...v, playerNotes }
      })
    case "updateVariant":
      return variants.map((v) =>
        v.id !== action.variantId ? v : { ...v, ...(action.name !== undefined && { name: action.name }), ...(action.note !== undefined && { note: action.note }) }
      )
    case "updateLineup":
      return variants.map((v) => ({
        ...v,
        lineups: v.lineups.map((l) =>
          l.id !== action.lineupId ? l : { ...l, ...(action.name !== undefined && { name: action.name }), ...(action.note !== undefined && { note: action.note }) }
        ),
      }))
    case "deleteLineup":
      return variants.map((v) => ({ ...v, lineups: v.lineups.filter((l) => l.id !== action.lineupId) }))
    case "deleteVariant":
      return variants.filter((v) => v.id !== action.variantId)
    default:
      // Creating things and votes need the server's answer (new IDs, the voter's name)
      return variants
  }
}
