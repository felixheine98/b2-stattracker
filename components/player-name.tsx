// A player's name inside a tournament: the name from back then, with today's name on hover when it differs
export function PlayerName({ name, currentName }: { name: string; currentName?: string | null }) {
  if (!currentName || currentName === name) return <>{name}</>
  return (
    <span title={`today: ${currentName}`} className="cursor-help underline decoration-dotted decoration-fg-subtle underline-offset-2">
      {name}
    </span>
  )
}
