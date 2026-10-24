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

// The lineup planning per match day (docs/adr/008) is on where MATCHDAY_PLANNING=on is set; in
// production since Felix switched it on on 23.10.2026.
export function matchdayPlanningEnabled(env: Env = process.env): boolean {
  return env.MATCHDAY_PLANNING === "on"
}

// The VOD archive (docs/adr/011): cutting matches out of Twitch VODs for the team's YouTube channel,
// with the public privacy page Google asks for. On where VOD_ARCHIVE is "auto" or "manual", the
// worker's modes (lib/vod-queue.ts); VOD links on matches stay either way.
export function vodArchiveEnabled(env: Env = process.env): boolean {
  return env.VOD_ARCHIVE === "auto" || env.VOD_ARCHIVE === "manual"
}
