// Rounds typed in by hand: only our players get a placement, the opponents take the places left over
import { roundScore, type RoundScore } from "./round-score"

// What is typed for one of our players: a placement, or that he did not finish
export type Cell = number | "dnf"

export type EntryState =
  | { kind: "empty" }
  | { kind: "incomplete" }
  // bad: placements used twice, or behind the last player who finished
  | { kind: "invalid"; bad: Set<number> }
  | ({ kind: "done" } & RoundScore)

// Players who finished take the places 1 to this number
function finisherCount(cells: Array<Cell | undefined>, opponentDnfs: number, size: number): number {
  return size * 2 - cells.filter((c) => c === "dnf").length - opponentDnfs
}

// cells holds one entry per player of ours, undefined where nothing is typed yet
export function entryState(cells: Array<Cell | undefined>, opponentDnfs: number, size: number): EntryState {
  const typed = cells.filter((c) => c !== undefined)
  if (typed.length === 0) return opponentDnfs > 0 ? { kind: "incomplete" } : { kind: "empty" }

  const places = typed.filter((c) => c !== "dnf")
  const finishers = finisherCount(cells, opponentDnfs, size)
  const bad = new Set(places.filter((v, i) => places.indexOf(v) !== i || v > finishers))
  if (bad.size > 0) return { kind: "invalid", bad }
  if (typed.length < size) return { kind: "incomplete" }

  const order = [
    ...Array.from({ length: finishers }, (_, i) => ({ isOurTeam: places.includes(i + 1), dnf: false })),
    ...Array.from({ length: size - places.length }, () => ({ isOurTeam: true, dnf: true })),
    ...Array.from({ length: opponentDnfs }, () => ({ isOurTeam: false, dnf: true })),
  ]
  const score = roundScore(order)
  return score ? { kind: "done", ...score } : { kind: "incomplete" }
}

// Placements to save for our players: DNFs are stored right behind the finishers, the opponents' DNFs come last
export function entryPositions(cells: Cell[], opponentDnfs: number, size: number): { positions: number[]; dnf: boolean[] } {
  let next = finisherCount(cells, opponentDnfs, size)
  return {
    positions: cells.map((c) => (c === "dnf" ? ++next : c)),
    dnf: cells.map((c) => c === "dnf"),
  }
}
