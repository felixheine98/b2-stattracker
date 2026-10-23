import { nameHint, shownName } from "@/lib/player-names"

// A player's name as the team knows it: the nickname where one is set (docs/adr/009-spitznamen.md),
// otherwise the gamertag, inside a tournament the one from back then. Hovering shows the gamertag
// and other names behind a nickname, or today's name behind an old one.
export function PlayerName({ name, nickname, currentName, allNames }: { name: string; nickname?: string | null; currentName?: string | null; allNames?: string[] }) {
  const hint = nameHint({ name, nickname, currentName, allNames })
  const shown = shownName({ name, nickname })
  if (!hint) return <>{shown}</>
  return (
    <span title={hint} className="cursor-help underline decoration-dotted decoration-fg-subtle underline-offset-2">
      {shown}
    </span>
  )
}
