import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { fetchAnnouncements, fetchReactions, fetchServerEmojis, fetchServerRoles, postAnnouncement, signReactionSnapshot, verifyReactionSnapshot } from "@/lib/discord-bot"
import { answersRevision, checkEmojis, emojiMapping, lastUsedEmojis, matchdayReactionPreview, withDefaultMapping, parseChannelLink, suggestAnnouncement } from "@/lib/matchday-discord"
import type { MatchdayAnswer } from "@/lib/matchday-plan"
import type { ReactionSnapshot } from "@/lib/discord-planning"
import { planAccess, type PlanParams } from "@/lib/matchday-plan-access"
import { loadPlan, type MatchdayDiscordSettings } from "@/lib/matchday-plan-db"
import { shownName } from "@/lib/player-names"
import { sortStages, stageDate } from "@/lib/stages"

// Discord for the matchday planning (docs/adr/008): the lineup channel, the marked ping of the match
// day, and its reactions as answers: taken over at once on fetching, with a preview only where a
// choice is missing (an emoji without a meaning, a player with two answers). Lineup managers fetch and apply, but do not
// link Discord accounts; that stays with admins and managers (ADR 006).

const answer = z.union([z.literal(""), z.enum(["FIX", "PARTIAL", "MAYBE", "OUT"])])
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("channel"), link: z.string().max(300) }),
  z.object({ action: z.literal("announcements") }),
  z.object({ action: z.literal("choose"), messageUrl: z.string().max(300) }),
  z.object({ action: z.literal("emojis") }),
  z.object({ action: z.literal("post"), text: z.string().trim().min(1).max(2000),
    emojis: z.array(z.object({ key: z.string().max(40), text: z.string().max(150), answer: z.enum(["FIX", "PARTIAL", "MAYBE", "OUT"]) })).max(20) }),
  z.object({ action: z.literal("settings"), emojiMapping: z.record(z.string().max(200), answer) }),
  z.object({ action: z.literal("fetch") }),
  z.object({ action: z.literal("sync") }),
  z.object({ action: z.literal("apply"), token: z.string().max(2_000_000), emojiMapping: z.record(z.string().max(200), answer), resolutions: z.record(z.string().max(100), answer) }),
])

class ImportError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

const MESSAGE_LINK = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/channels\/(\d{1,20})\/(\d{1,20})\/(\d{1,20})$/

export async function POST(req: Request, ctx: PlanParams) {
  const found = await planAccess(ctx)
  if (!found.ok) return found.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  const input = parsed.data
  const { lineup, stageId } = found
  try {
    if (input.action === "channel") {
      const channel = parseChannelLink(input.link)
      if (!channel) throw new ImportError("Enter a link to the lineup's Discord channel or to a message in it.")
      await db.tournamentLineup.update({ where: { id: lineup.id }, data: { discordChannelId: channel.channelId } })
      return NextResponse.json({ channelId: channel.channelId })
    }

    const plan = await loadPlan(lineup.id, stageId)
    const channelId = plan.discordChannelId
    if (!channelId) throw new ImportError("Enter the lineup's Discord channel first.")
    const settings = plan.discordSettings
    // Link and emoji choices are kept at once; they leave an open preview valid
    const saveSettings = (changes: Partial<MatchdayDiscordSettings>) =>
      db.matchdayPlan.update({ where: { id: plan.planId }, data: { discordSettings: { emojiMapping: {}, ...settings, ...changes } as unknown as Prisma.InputJsonValue } })

    if (input.action === "announcements") {
      const announcements = await fetchAnnouncements(channelId)
      // The pings other match days of the lineup already use
      const others = await db.matchdayPlan.findMany({ where: { lineupId: lineup.id, stageId: { not: stageId } }, select: { discordSettings: true } })
      const taken = others.map((o) => (o.discordSettings as MatchdayDiscordSettings | null)?.messageUrl).filter((url): url is string => !!url)
      const suggested = suggestAnnouncement(announcements, await matchDay(lineup.id, stageId, lineup.tournament), taken)
      return NextResponse.json({ announcements, taken, suggested: suggested?.messageUrl ?? null })
    }
    if (input.action === "choose") {
      const link = input.messageUrl.trim().match(MESSAGE_LINK)
      if (!link || link[2] !== channelId) throw new ImportError("Choose a message in the lineup's channel.")
      await saveSettings({ messageUrl: `https://discord.com/channels/${link[1]}/${link[2]}/${link[3]}` })
      return NextResponse.json({ ok: true })
    }
    if (input.action === "emojis") {
      // The server's own emojis to choose from, and the ones the lineup's latest announcement had
      const plans = await db.matchdayPlan.findMany({ where: { lineupId: lineup.id }, select: { discordSettings: true } })
      const lastUsed = lastUsedEmojis(plans.map((p) => (p.discordSettings ?? {}) as MatchdayDiscordSettings))
      // What the text can mention: the server's roles (the page offers the comp's first) and the
      // kader's players with a linked account. Without the roles an announcement can still be written.
      const [server, roles, linked] = await Promise.all([
        fetchServerEmojis(),
        fetchServerRoles(channelId).catch((error: Error) => ({ roles: [], mentionAll: false, rolesError: error.message })),
        db.player.findMany({ where: { id: { in: plan.kader.map((p) => p.id) }, discordUserId: { not: null } }, select: { id: true, name: true, nickname: true, discordUserId: true }, orderBy: { name: "asc" } }),
      ])
      const players = linked.map((p) => ({ id: p.id, name: shownName(p), discordUserId: p.discordUserId! }))
      return NextResponse.json({ server, lastUsed, ...roles, comp: lineup.tournament.name, lineup: lineup.name, players })
    }
    if (input.action === "post") {
      const wrong = checkEmojis(input.emojis)
      if (wrong) throw new ImportError(wrong)
      // The bot posts it with its emojis, so what they mean is known from the start; a new
      // announcement starts without a fetch
      const posted = await postAnnouncement(channelId, input.text, input.emojis.map((e) => e.text))
      const discordSettings = { messageUrl: posted.messageUrl, emojiMapping: emojiMapping(input.emojis), emojis: input.emojis, postedAt: posted.postedAt }
      await db.matchdayPlan.update({ where: { id: plan.planId }, data: { discordSettings } })
      return NextResponse.json(discordSettings)
    }
    if (input.action === "settings") {
      await saveSettings({ emojiMapping: input.emojiMapping })
      return NextResponse.json({ ok: true })
    }

    const secret = process.env.AUTH_SECRET
    if (!secret) throw new ImportError("The import signing key is not configured.", 503)
    const kaderAnswers = () => Object.fromEntries(plan.kader.map((p) => [p.id, plan.answers[p.id]?.answer ?? null]))
    const accounts = async (discordUserIds: string[]) => {
      const [linked, marked] = await Promise.all([
        db.player.findMany({ where: { discordUserId: { in: discordUserIds } }, select: { id: true, discordUserId: true } }),
        db.discordNonPlayer.findMany({ where: { discordUserId: { in: discordUserIds } } }),
      ])
      return { links: Object.fromEntries(linked.map((p) => [p.discordUserId!, p.id])), notAPlayer: marked.map((m) => m.discordUserId) }
    }
    // The signed preview belongs to this planning only
    const scope = `matchday:${plan.planId}`

    // The preview to choose in: signed for the answers as they are after `answers`
    const previewFor = (snapshot: ReactionSnapshot, known: Awaited<ReturnType<typeof accounts>>, answers: Record<string, MatchdayAnswer | null>) => {
      const revision = answersRevision(answers)
      return {
        snapshot, ...known, revision, token: signReactionSnapshot({ snapshot, tournamentId: scope, revision }, secret),
        // Accounts without a link or mark; which of them matter depends on the emoji choice
        unlinked: snapshot.users.filter((u) => !Object.hasOwn(known.links, u.id) && !known.notAPlayer.includes(u.id)),
      }
    }

    if (input.action === "fetch" || input.action === "sync") {
      if (!settings?.messageUrl) throw new ImportError("Choose the announcement of this match day first.")
      const snapshot = await fetchReactions(settings.messageUrl)
      await saveSettings({ fetchedAt: snapshot.fetchedAt })
      const known = await accounts(snapshot.users.map((u) => u.id))
      const mapping = withDefaultMapping(settings.emojiMapping ?? {})
      // Without a meaning for every emoji nothing is taken over yet
      if (input.action === "fetch" || snapshot.reactions.some((r) => !Object.hasOwn(mapping, r.key))) {
        return NextResponse.json({ ...previewFor(snapshot, known, kaderAnswers()), ...(input.action === "sync" && { applied: null }) })
      }
      const result = await db.$transaction(async (tx) => {
        // The answers as they are now, so one set by hand in the meantime is not overwritten blindly
        const current = await tx.matchdayPlanAnswer.findMany({ where: { planId: plan.planId }, select: { playerId: true, answer: true } })
        const kader = plan.kader.map((p) => ({ playerId: p.id, answer: (current.find((a) => a.playerId === p.id)?.answer as MatchdayAnswer | undefined) ?? null }))
        const { rows, unlinked } = matchdayReactionPreview(snapshot, mapping, known.links, known.notAPlayer, kader, {})
        const changes = rows.filter((r) => r.kind === "change" && r.after)
        for (const row of changes) {
          const reactedAt = row.times[row.after!]
          const data = { answer: row.after!, answeredAt: reactedAt ? new Date(reactedAt) : null }
          await tx.matchdayPlanAnswer.upsert({ where: { planId_playerId: { planId: plan.planId, playerId: row.playerId } }, create: { planId: plan.planId, playerId: row.playerId, ...data }, update: data })
        }
        const after = Object.fromEntries(kader.map((p) => [p.playerId, changes.find((c) => c.playerId === p.playerId)?.after ?? p.answer]))
        return { rows, unlinked, changes, after }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      return NextResponse.json({
        ...previewFor(snapshot, known, result.after),
        applied: result.changes.map((r) => ({ playerId: r.playerId, before: r.before, after: r.after, time: r.times[r.after!] ?? null })),
        // Players who reacted with two answers stay to be resolved through the preview
        conflicts: result.rows.filter((r) => r.kind === "conflict"),
        unlinked: result.unlinked,
      })
    }

    const signed = verifyReactionSnapshot(input.token, secret, scope)
    for (const reaction of signed.snapshot.reactions) {
      if (!Object.hasOwn(input.emojiMapping, reaction.key)) throw new ImportError("Choose an answer or Ignore for every emoji.")
    }
    const known = await accounts(signed.snapshot.users.map((u) => u.id))
    const kader = plan.kader.map((p) => ({ playerId: p.id, answer: plan.answers[p.id]?.answer ?? null }))
    const { rows } = matchdayReactionPreview(signed.snapshot, input.emojiMapping, known.links, known.notAPlayer, kader, input.resolutions)
    if (rows.some((r) => r.kind === "conflict")) throw new ImportError("Resolve or skip all conflicting answers first.")
    const changes = rows.filter((r) => r.kind === "change" && r.after)
    await db.$transaction(async (tx) => {
      // The answers are read again in here: one set by hand or a second import since the fetch makes the preview stale
      const current = await tx.matchdayPlanAnswer.findMany({ where: { planId: plan.planId }, select: { playerId: true, answer: true } })
      const now = Object.fromEntries(plan.kader.map((p) => [p.id, (current.find((a) => a.playerId === p.id)?.answer as MatchdayAnswer | null | undefined) ?? null]))
      if (answersRevision(now) !== signed.revision) throw new ImportError("The answers changed since this preview. Fetch the reactions again.", 409)
      for (const row of changes) {
        const reactedAt = row.times[row.after!]
        const data = { answer: row.after!, answeredAt: reactedAt ? new Date(reactedAt) : null }
        await tx.matchdayPlanAnswer.upsert({ where: { planId_playerId: { planId: plan.planId, playerId: row.playerId } }, create: { planId: plan.planId, playerId: row.playerId, ...data }, update: data })
      }
      await tx.matchdayPlan.update({ where: { id: plan.planId }, data: { discordSettings: { ...settings, messageUrl: signed.snapshot.messageUrl, emojiMapping: input.emojiMapping, fetchedAt: signed.snapshot.fetchedAt } as unknown as Prisma.InputJsonValue } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return NextResponse.json({ changed: changes.length })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2034") return NextResponse.json({ error: "The answers changed. Fetch the reactions again." }, { status: 409 })
      console.error("Matchday Discord import:", error)
      return NextResponse.json({ error: "The import could not be saved." }, { status: 500 })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Discord import failed." }, { status: error instanceof ImportError ? error.status : 400 })
  }
}

// The day of the match day: its first planned match, otherwise the week of the stage
async function matchDay(lineupId: string, stageId: string, tournament: { stages: Array<{ id: string; type: "SEEDING" | "GROUP" | "PLAYOFF"; number: number }> }) {
  const first = await db.match.findFirst({ where: { tournamentLineupId: lineupId, stageId, date: { not: null } }, orderBy: { date: "asc" }, select: { date: true, tournament: { select: { startDate: true, createdAt: true } } } })
  if (first?.date) return first.date
  const stages = sortStages(tournament.stages)
  const comp = await db.tournament.findFirstOrThrow({ where: { stages: { some: { id: stageId } } }, select: { startDate: true, createdAt: true } })
  return stageDate(stages.find((s) => s.id === stageId)!, stages, new Date(comp.startDate ?? comp.createdAt))
}
