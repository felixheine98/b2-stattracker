import { describe, expect, it } from "vitest"
import { feedbackSubmission, feedbackStatus, feedbackListQuery, validFeedbackToken } from "./feedback"

describe("private app feedback", () => {
  const input = { interactionId: "123", guildId: "456", channelId: "789", authorId: "1234", authorName: "Felix", category: "BUG", title: "  Button broken  ", text: "  Does not save on my phone.  " }
  it("validates and trims a submission without trusting a supplied status", () => {
    expect(feedbackSubmission.parse({ ...input, status: "DONE" })).toEqual({ ...input, title: "Button broken", text: "Does not save on my phone." })
    for (const change of [{ text: " " }, { title: "" }, { text: "x".repeat(4001) }, { category: "OTHER_USER" }, { authorId: "abc" }]) {
      expect(feedbackSubmission.safeParse({ ...input, ...change }).success).toBe(false)
    }
  })
  it("accepts only the three supported workflow statuses", () => {
    for (const status of ["OPEN", "IN_PROGRESS", "DONE"]) expect(feedbackStatus.safeParse(status).success).toBe(true)
    expect(feedbackStatus.safeParse("deleted").success).toBe(false)
  })
  it("requires an explicitly configured bearer secret", () => {
    expect(validFeedbackToken("Bearer secret", "secret")).toBe(true)
    expect(validFeedbackToken("Bearer other", "secret")).toBe(false)
    expect(validFeedbackToken(null, "secret")).toBe(false)
    expect(validFeedbackToken("Bearer undefined", undefined)).toBe(false)
    expect(validFeedbackToken("Bearer ", "")).toBe(false)
  })
  it("validates the admin list's status and bounded page cursor", () => {
    expect(feedbackListQuery.parse({})).toEqual({ status: "ALL" })
    expect(feedbackListQuery.parse({ status: "OPEN", cursor: "entry-1" })).toEqual({ status: "OPEN", cursor: "entry-1" })
    expect(feedbackListQuery.safeParse({ status: "hidden" }).success).toBe(false)
    expect(feedbackListQuery.safeParse({ cursor: "x".repeat(101) }).success).toBe(false)
  })
})
