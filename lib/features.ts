// Features that can be switched off. The format rules of a competition (docs/adr/005) are on
// only where MATCH_RULES=on is set, and never in production, whatever the setting says.
type Env = Partial<Record<string, string>>

export function matchRulesEnabled(env: Env = process.env): boolean {
  return env.NODE_ENV !== "production" && env.MATCH_RULES === "on"
}
