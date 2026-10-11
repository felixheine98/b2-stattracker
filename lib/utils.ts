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

// Players per team for round formats; null for formats without team rounds (seeding)
export function teamSize(format: Format): number | null {
  const m = /^ROUND_(\d)V\d$/.exec(format)
  return m ? Number(m[1]) : null
}

// Parses "45.123", "1:02.345" or plain milliseconds ("45123").
// Returns null for empty input and undefined for input that is not a time.
export function parseTime(text: string): number | null | undefined {
  const value = text.trim()
  if (!value) return null
  if (/^\d{4,}$/.test(value)) return Number(value)
  const m = /^(?:(\d+):)?(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(value)
  if (!m) return undefined
  const minutes = m[1] ? Number(m[1]) : 0
  const seconds = Number(m[2])
  if (m[1] && seconds >= 60) return undefined
  const ms = minutes * 60000 + seconds * 1000 + Number((m[3] ?? "").padEnd(3, "0"))
  return ms > 0 ? ms : undefined
}
