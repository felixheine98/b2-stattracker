import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Format } from "@prisma/client"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const milliseconds = ms % 1000
  const p2 = (n: number) => n.toString().padStart(2, "0")
  const p3 = (n: number) => n.toString().padStart(3, "0")
  if (minutes > 0) return `${minutes}:${p2(seconds)}.${p3(milliseconds)}`
  return `${seconds}.${p3(milliseconds)}`
}

export function formatLabel(format: Format): string {
  const map: Record<Format, string> = {
    ROUND_1V1: "1v1",
    ROUND_2V2: "2v2",
    ROUND_3V3: "3v3",
    ROUND_4V4: "4v4",
    ROUND_5V5: "5v5",
    TIME_ATTACK_10: "Seeding",
  }
  return map[format]
}

export function formatLabelLong(format: Format): string {
  const map: Record<Format, string> = {
    ROUND_1V1: "1v1 Round",
    ROUND_2V2: "2v2 Round",
    ROUND_3V3: "3v3 Round",
    ROUND_4V4: "4v4 Round",
    ROUND_5V5: "5v5 Round",
    TIME_ATTACK_10: "Seeding (Time Attack)",
  }
  return map[format]
}

export interface CsvRow {
  time: number
  track: string
  playerId: string
  playerName: string
  record: number
  roundNumber: number
}

export function parseCSV(csv: string): CsvRow[] {
  const lines = csv.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
  const idx = (name: string) => headers.indexOf(name)
  const timeIdx = idx("time")
  const trackIdx = idx("track")
  const playerIdIdx = idx("playerid")
  const playerNameIdx = idx("playername")
  const recordIdx = idx("record")
  const roundIdx = idx("roundnumber")

  if ([timeIdx, trackIdx, playerIdIdx, playerNameIdx, recordIdx, roundIdx].some((i) => i === -1)) {
    throw new Error("Invalid CSV: missing required columns (Time, Track, PlayerID, PlayerName, Record, RoundNumber)")
  }

  return lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const cols = line.split(",").map((c) => c.trim())
      return {
        time: parseInt(cols[timeIdx]),
        track: cols[trackIdx],
        playerId: cols[playerIdIdx],
        playerName: cols[playerNameIdx],
        record: parseInt(cols[recordIdx]),
        roundNumber: parseInt(cols[roundIdx]),
      }
    })
}
