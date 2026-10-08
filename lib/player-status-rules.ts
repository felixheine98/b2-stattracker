import { dayKey } from "@/lib/player-status"

// Switch dates may not lie in the future. The server runs on UTC, so allow one extra
// day: for a user east of UTC "today" can already be the server's tomorrow.
export function latestAllowedDay(): string {
  return dayKey(new Date(Date.now() + 24 * 60 * 60 * 1000))
}
