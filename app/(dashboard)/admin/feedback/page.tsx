import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { notFound, redirect } from "next/navigation"
import { FeedbackView } from "./feedback-view"
import { feedbackListQuery } from "@/lib/feedback"

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth()
  if (session?.user?.role !== "ADMIN") redirect("/dashboard")
  if (process.env.APP_FEEDBACK !== "on") notFound()
  const query = feedbackListQuery.safeParse(await searchParams)
  if (!query.success) notFound()
  const { status, cursor } = query.data
  const where = status === "ALL" ? {} : { status }
  const [items, panel, count] = await Promise.all([
    db.appFeedback.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) }),
    db.feedbackPanel.findUnique({ where: { id: "discord" } }),
    db.appFeedback.count({ where }),
  ])
  return <FeedbackView key={`${status}:${cursor ?? ""}`} initialItems={items.slice(0, 50).map(item => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() }))} initialPanel={panel} count={count} filter={status} cursor={cursor} nextCursor={items.length > 50 ? items[49].id : null} />
}
