// A selection of IDs kept in the address as ?key=a,b. Nothing selected means "all".
// With a default selection, "all" has to be written out, or the default would take over again.
const ALL = "all"

// raw is the parameter's value, null when it is missing
export function parseIdList(raw: string | null, validIds: string[], defaultIds: string[]): string[] {
  const ids = raw === null ? defaultIds : raw.split(",")
  return ids.filter((id) => validIds.includes(id))
}

// The value to write for a selection, null to remove the parameter
export function serializeIdList(ids: string[], defaultIds: string[]): string | null {
  if (ids.length === 0) return defaultIds.length > 0 ? ALL : null
  const isDefault = ids.length === defaultIds.length && ids.every((id) => defaultIds.includes(id))
  return isDefault ? null : ids.join(",")
}
