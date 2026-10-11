"use client"

import { BASE_PATH } from "@/lib/base-path"
import type { PlanningState } from "@/lib/planning-db"
import type { Activity, Present } from "@/lib/planning-presence"
import { useCallback, useEffect, useRef, useState } from "react"

const INTERVAL_MS = 1500

// Keeps an open planning page in step with everyone else: every second or two it reports what
// this viewer is doing and fetches what changed. Own changes are shown at once (mutate) and
// confirmed by the next round.
export function usePlanningLive(initial: PlanningState, activity: Activity) {
  const [state, setState] = useState(initial)
  const [presence, setPresence] = useState<Present[]>([])
  // The revision shown, the number of own changes still on their way, and the latest activity
  const revision = useRef(initial.revision)
  const writing = useRef(0)
  const current = useRef(activity)
  const wake = useRef<() => void>(() => {})
  const tournamentId = initial.tournament.id

  useEffect(() => {
    current.current = activity
  }, [activity])

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function round() {
      // A hidden tab neither reports nor fetches; it catches up when it is shown again
      if (document.visibilityState === "visible") {
        const res = await fetch(`${BASE_PATH}/api/tournaments/${tournamentId}/planning/live`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision: revision.current, activity: current.current }),
        }).catch(() => null)
        const data = res?.ok ? await res.json().catch(() => null) : null
        if (stopped) return
        if (data) {
          setPresence(data.presence)
          // While an own change is on its way the answer may predate it and would undo it on screen
          if (writing.current === 0) {
            if (data.state) {
              revision.current = data.revision
              setState(data.state)
            } else {
              setState((s) => (s.archived === data.archived ? s : { ...s, archived: data.archived }))
            }
          }
        }
      }
      timer = setTimeout(round, INTERVAL_MS)
    }

    wake.current = () => {
      clearTimeout(timer)
      round()
    }
    round()
    document.addEventListener("visibilitychange", wake.current)
    return () => {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", wake.current)
    }
  }, [tournamentId])

  // An own change: shown at once, sent, and then the server's state is fetched to confirm it.
  // Resolves to an error message, or null when it went through.
  const mutate = useCallback(async (optimistic: (state: PlanningState) => PlanningState, request: () => Promise<Response | null>) => {
    writing.current++
    setState(optimistic)
    const res = await request().catch(() => null)
    const data = await res?.json().catch(() => null)
    writing.current--
    // Whatever happened, the next round fetches the full state
    revision.current = -1
    wake.current()
    return res?.ok ? null : ((data?.error as string | undefined) ?? "Speichern fehlgeschlagen")
  }, [])

  return { state, presence, mutate }
}

export type PlanningMutate = ReturnType<typeof usePlanningLive>["mutate"]
