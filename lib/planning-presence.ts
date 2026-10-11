// Who has a planning open right now and what they are doing there. Kept in memory only:
// everyone reports in every second or two (see the live route), and whoever stops is gone
// a few seconds later. A server restart simply empties it.

export interface Activity {
  // The variant someone is working in, and the player they have picked up there
  variantId: string | null
  playerId: string | null
  // The note they are typing: "variant:<id>" or "player:<variantId>:<playerId>"
  typing: string | null
}

export interface Present {
  userId: string
  name: string
  activity: Activity
}

const TIMEOUT_MS = 6000

export function createPresence() {
  const byTournament = new Map<string, Map<string, Present & { seenAt: number }>>()

  return {
    touch(tournamentId: string, user: { id: string; name: string }, activity: Activity, now: number) {
      if (!byTournament.has(tournamentId)) byTournament.set(tournamentId, new Map())
      byTournament.get(tournamentId)!.set(user.id, { userId: user.id, name: user.name, activity, seenAt: now })
    },

    // Everyone seen within the last few seconds, by name
    list(tournamentId: string, now: number): Present[] {
      const users = byTournament.get(tournamentId)
      if (!users) return []
      for (const [id, entry] of users) if (now - entry.seenAt > TIMEOUT_MS) users.delete(id)
      return [...users.values()]
        .map(({ userId, name, activity }) => ({ userId, name, activity }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
  }
}

// One store for the whole server process; kept on globalThis so a code reload in development does not empty it
const holder = globalThis as { planningPresence?: ReturnType<typeof createPresence> }
export const planningPresence = (holder.planningPresence ??= createPresence())
