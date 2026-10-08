import { useState } from "react"

// State initialised from server data that follows the server again whenever
// fresh data arrives (e.g. after router.refresh()), instead of keeping a stale copy.
export function useSyncedState<T>(value: T) {
  const [state, setState] = useState(value)
  const [previous, setPrevious] = useState(value)
  if (previous !== value) {
    setPrevious(value)
    setState(value)
  }
  return [state, setState] as const
}
