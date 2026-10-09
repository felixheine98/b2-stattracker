// A player's name inside a tournament: the name from back then, with today's name on hover when it differs
export function PlayerName({ name, currentName }: { name: string; currentName?: string | null }) {
  if (!currentName || currentName === name) return <>{name}</>
  return (
    <span title={`heute: ${currentName}`} className="cursor-help underline decoration-dotted decoration-[#5e5858] underline-offset-2">
      {name}
    </span>
  )
}
