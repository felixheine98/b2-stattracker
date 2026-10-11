"use client"

import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { BASE_PATH } from "@/lib/base-path"
import { search, type SearchEntry, type SearchKind } from "@/lib/search"
import { cn } from "@/lib/utils"
import { Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

const OPEN_EVENT = "open-search"

// Opens the search from anywhere, e.g. from the buttons in the navigation
export function openSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

const GROUP_LABEL: Record<SearchKind, string> = {
  player: "Players",
  team: "Opponent teams",
  lineup: "Opponent lineups",
  opponentPlayer: "Opponent players",
  tournament: "Tournaments",
  match: "Matches",
}

// The search over players, opponents, tournaments and matches. Mounted once for the whole app;
// Ctrl+K (or Cmd+K) opens it, the arrow keys move through the hits and Enter opens one.
export function SearchDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<SearchEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)

  useEffect(() => {
    // Loaded anew on every opening, so it never shows a stale state for long
    function show() {
      setOpen(true)
      setFailed(false)
      fetch(`${BASE_PATH}/api/search`)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then(setEntries)
        .catch(() => setFailed(true))
    }
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        show()
      }
    }
    window.addEventListener(OPEN_EVENT, show)
    document.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener(OPEN_EVENT, show)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  function close() {
    setOpen(false)
    setQuery("")
    setActive(0)
  }

  const groups = entries ? search(entries, query) : []
  const hits = groups.flatMap((g) => g.hits)

  function go(href: string) {
    close()
    router.push(href)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (hits.length > 0) setActive((i) => (i + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (hits[active]) go(hits[active].entry.href)
    }
  }

  let index = -1
  return (
    <Dialog open={open} onClose={close} className="max-w-xl md:mt-[10vh] md:max-h-[75vh] md:self-start">
      <div className="relative mr-8">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5e5858]" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0) }}
          onKeyDown={handleKeyDown}
          placeholder="Players, opponents, tournaments, matches…"
          aria-label="Search"
          autoComplete="off"
          className="h-10 pl-9"
        />
      </div>

      <div className="mt-4 space-y-4">
        {failed && <p className="text-sm text-[#ED1F24]">The search could not be loaded.</p>}
        {!failed && !query.trim() && (
          <p className="text-sm text-[#5e5858]">Finds players (also by former names), opponent teams and their lineups, tournaments and matches.</p>
        )}
        {!failed && query.trim() && entries === null && <p className="text-sm text-[#5e5858]">Loading…</p>}
        {query.trim() && entries !== null && hits.length === 0 && <p className="text-sm text-[#5e5858]">Nothing found.</p>}

        {groups.map((group) => (
          <section key={group.kind}>
            <h3 className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-[#5e5858]">{GROUP_LABEL[group.kind]}</h3>
            <ul>
              {group.hits.map(({ entry, via }) => {
                const i = ++index
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      // Keeps the hit under the arrow keys in view
                      ref={i === active ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
                      onClick={() => go(entry.href)}
                      onMouseMove={() => setActive(i)}
                      className={cn(
                        "flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md px-2 py-2 text-left text-sm",
                        i === active ? "bg-[#FBD00D]/10 text-[#f5f0f0]" : "text-[#c5bfbf]"
                      )}
                    >
                      <span className="min-w-0 break-words font-medium">{entry.title}</span>
                      {via && <span className="text-xs text-[#9a9090]">also: {via}</span>}
                      {entry.detail && <span className="text-xs text-[#5e5858]">{entry.detail}</span>}
                      {entry.marker && <span className="text-xs text-[#cd7f32]">{entry.marker}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
            {group.total > group.hits.length && (
              <p className="px-2 pt-1 text-xs text-[#5e5858]">+ {group.total - group.hits.length} more, narrow the search</p>
            )}
          </section>
        ))}
      </div>
    </Dialog>
  )
}
