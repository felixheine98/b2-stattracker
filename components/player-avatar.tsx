import { BASE_PATH } from "@/lib/base-path"
import { cn } from "@/lib/utils"

interface Props {
  player: { name: string; country?: string | null }
  className?: string
}

// Round player badge: the country flag if one is set, otherwise the first letter of the name
export function PlayerAvatar({ player, className }: Props) {
  if (player.country) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`${BASE_PATH}/flags/${player.country}.svg`}
        alt={player.country.toUpperCase()}
        title={player.country.toUpperCase()}
        className={cn("h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-[#3a3435]", className)}
      />
    )
  }
  return (
    <div
      className={cn(
        "h-6 w-6 rounded-full bg-[#FBD00D]/15 flex items-center justify-center text-[#FBD00D] text-xs font-bold shrink-0",
        className
      )}
    >
      {player.name.charAt(0).toUpperCase()}
    </div>
  )
}
