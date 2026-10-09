"use client"

import { useSyncExternalStore } from "react"

// Matches the md breakpoint: below it the phone layout is used
const QUERY = "(max-width: 767px)"

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

// True on phone-sized screens. For behaviour that CSS alone cannot switch, such as which keyboard is used.
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false)
}
