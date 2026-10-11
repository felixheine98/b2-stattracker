"use client"

import { parseIdList, serializeIdList } from "@/lib/id-list-param"
import { useSearchParams } from "next/navigation"

// A selection of IDs kept in the address (?key=a,b), so a reload or shared link shows the same.
// IDs that no longer exist are dropped. defaultIds is what is selected until the user chooses.
export function useIdListParam(key: string, validIds: string[], defaultIds: string[] = []): [string[], (ids: string[]) => void] {
  const ids = parseIdList(useSearchParams().get(key), validIds, defaultIds)

  function select(next: string[]) {
    const params = new URLSearchParams(window.location.search)
    const value = serializeIdList(next, defaultIds.filter((id) => validIds.includes(id)))
    if (value !== null) params.set(key, value)
    else params.delete(key)
    const query = params.toString()
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname)
  }

  return [ids, select]
}
