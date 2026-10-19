// Features that can be switched off. The format rules of a competition (docs/adr/005) are on
// only where MATCH_RULES=on is set, and never in production, whatever the setting says.
type Env = Partial<Record<string, string>>

export function matchRulesEnabled(env: Env = process.env): boolean {
  return env.NODE_ENV !== "production" && env.MATCH_RULES === "on"
}

// The comparison page of transcribed stats screenshots (docs/adr/007) reads the screenshots from
// a local folder; it is on only where SUMMARY_COMPARE=on and the folder are set, never in production.
export function summaryCompareEnabled(env: Env = process.env): boolean {
  return env.NODE_ENV !== "production" && env.SUMMARY_COMPARE === "on" && !!env.SUMMARY_SCREENSHOTS_DIR
}
