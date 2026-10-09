"use client"

import { useSearchParams } from "next/navigation"

// A selection of IDs kept in the address (?key=a,b), so a reload or shared link shows the same.
// IDs that no longer exist are dropped; an empty selection removes the parameter.
export function useIdListParam(key: string, validIds: string[]): [string[], (ids: string[]) => void] {
  const raw = useSearchParams().get(key)
  const ids = (raw ? raw.split(",") : []).filter((id) => validIds.includes(id))

  function select(next: string[]) {
    const params = new URLSearchParams(window.location.search)
    if (next.length > 0) params.set(key, next.join(","))
    else params.delete(key)
    const query = params.toString()
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname)
  }

  return [ids, select]
}
