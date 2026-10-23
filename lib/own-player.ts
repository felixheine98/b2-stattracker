// The player the signed-in account belongs to, whose rows the stats highlight lightly
export interface OwnPlayer {
  id: string
  tmId: string | null
}

// A row is the own one by its player or by its Trackmania account
export function isOwnPlayer(own: OwnPlayer | null, row: { id?: string | null; playerId?: string | null; tmId?: string | null }): boolean {
  if (!own) return false
  const id = row.playerId ?? row.id
  return (!!id && id === own.id) || (!!row.tmId && row.tmId.toLowerCase() === own.tmId?.toLowerCase())
}
