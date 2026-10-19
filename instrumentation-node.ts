import { sweepUnusedMessages } from "@/lib/reaction-log-db"

const HOUR = 60 * 60 * 1000
const marker = Symbol.for("b2.reactionLogSweep")
const scope = globalThis as unknown as Record<symbol, boolean>

// The bot keeps the time of reactions for messages in the announcement channel; the ones no comp
// claims within a week go. Once shortly after the start, then every hour. Without a bot there is nothing to do.
if (process.env.DISCORD_BOT_URL && process.env.DISCORD_BOT_API_TOKEN && !scope[marker]) {
  scope[marker] = true
  const sweep = () => sweepUnusedMessages().then(
    removed => { if (removed.length) console.log(`Reaction log: forgot ${removed.length} unused ${removed.length === 1 ? "message" : "messages"}`) },
    (error: unknown) => console.error("Reaction log sweep failed:", error instanceof Error ? error.message : error),
  )
  setTimeout(sweep, 60 * 1000).unref()
  setInterval(sweep, HOUR).unref()
}
