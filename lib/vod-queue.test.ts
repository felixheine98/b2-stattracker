import { describe, expect, it } from "vitest"
import { afterFailure, downloadFailure, pickClip, type QueuedClip } from "./vod-queue"

const now = new Date("2026-11-08T20:00:00Z")
const minutes = (n: number) => new Date(now.getTime() + n * 60_000)
const clip = (id: string, change: Partial<QueuedClip> = {}): QueuedClip => ({ id, status: "WAITING", attempts: 0, nextAttemptAt: null, requestedAt: null, startedAt: null, updatedAt: minutes(-60), ...change })

describe("the VOD backup queue", () => {
  it("takes the clip that has waited longest and is due", () => {
    const clips = [
      clip("later", { updatedAt: minutes(-10) }),
      clip("first", { updatedAt: minutes(-30) }),
      clip("retry not yet due", { updatedAt: minutes(-90), nextAttemptAt: minutes(5) }),
      clip("done", { status: "DONE", updatedAt: minutes(-120) }),
      clip("failed", { status: "FAILED", updatedAt: minutes(-120) }),
    ]
    expect(pickClip(clips, { now, mode: "auto" })?.id).toBe("first")
  })

  it("takes only the clips asked for by hand in manual mode (dev), and none when switched off", () => {
    const clips = [clip("saved"), clip("asked for", { updatedAt: minutes(-5), requestedAt: minutes(-1) })]
    expect(pickClip(clips, { now, mode: "manual" })?.id).toBe("asked for")
    expect(pickClip([clip("saved")], { now, mode: "manual" })).toBeNull()
    expect(pickClip(clips, { now, mode: "off" })).toBeNull()
  })

  it("takes a clip up again that got stuck loading, as when the worker was restarted midway", () => {
    expect(pickClip([clip("stuck", { status: "LOADING", startedAt: minutes(-4 * 60) })], { now, mode: "auto" })?.id).toBe("stuck")
    expect(pickClip([clip("loading", { status: "LOADING", startedAt: minutes(-30) })], { now, mode: "auto" })).toBeNull()
  })

  it("tries again three times after a passing failure, waiting longer each time, then gives up", () => {
    const failure = { kind: "transient" as const, message: "HTTP Error 503" }
    const first = afterFailure(clip("c", { status: "LOADING" }), failure, now)
    expect(first).toEqual({ status: "WAITING", attempts: 1, nextAttemptAt: minutes(10), error: "HTTP Error 503" })
    const second = afterFailure(clip("c", { status: "LOADING", attempts: 1 }), failure, now)
    expect(second).toMatchObject({ status: "WAITING", attempts: 2, nextAttemptAt: minutes(60) })
    const third = afterFailure(clip("c", { status: "LOADING", attempts: 2 }), failure, now)
    expect(third).toMatchObject({ status: "WAITING", attempts: 3, nextAttemptAt: minutes(240) })
    const fourth = afterFailure(clip("c", { status: "LOADING", attempts: 3 }), failure, now)
    expect(fourth).toEqual({ status: "FAILED", attempts: 4, nextAttemptAt: null, error: "HTTP Error 503" })
  })

  it("gives up at once when the VOD is gone or only for subscribers, saying why", () => {
    expect(afterFailure(clip("c", { status: "LOADING" }), { kind: "gone", message: "HTTP Error 404" }, now)).toEqual({ status: "FAILED", attempts: 1, nextAttemptAt: null, error: "The VOD is no longer available." })
    expect(afterFailure(clip("c", { status: "LOADING" }), { kind: "subscribers", message: "subscriber-only" }, now)).toEqual({ status: "FAILED", attempts: 1, nextAttemptAt: null, error: "Only for subscribers – back it up yourself or ask the channel." })
  })

  it("waits for YouTube's new daily quota (midnight Pacific time) without counting it as an attempt", () => {
    const quota = { kind: "quota" as const, message: "quotaExceeded" }
    // November: Pacific standard time, UTC−8
    expect(afterFailure(clip("c", { status: "LOADING", attempts: 2 }), quota, now)).toEqual({ status: "WAITING", attempts: 2, nextAttemptAt: new Date("2026-11-09T08:05:00Z"), error: "YouTube's daily upload limit is used up; it continues after it resets." })
    // July: Pacific daylight time, UTC−7
    expect(afterFailure(clip("c"), quota, new Date("2026-07-01T20:00:00Z")).nextAttemptAt).toEqual(new Date("2026-07-02T07:05:00Z"))
  })

  it("waits an hour while YouTube is not connected, without counting it as an attempt", () => {
    expect(afterFailure(clip("c", { status: "LOADING" }), { kind: "setup", message: "YouTube is not connected." }, now)).toEqual({ status: "WAITING", attempts: 0, nextAttemptAt: minutes(60), error: "YouTube is not connected." })
  })

  it("tell from yt-dlp's message whether the VOD is gone, only for subscribers, or just not reachable", () => {
    expect(downloadFailure("ERROR: [twitch:vod] v2281234567: Video 2281234567 does not exist").kind).toBe("gone")
    expect(downloadFailure("ERROR: [twitch:vod] v2281234567: Unable to download JSON metadata: HTTP Error 404: Not Found").kind).toBe("gone")
    expect(downloadFailure("ERROR: [twitch:vod] v2281234567: This video is only available for subscribers").kind).toBe("subscribers")
    expect(downloadFailure("ERROR: [twitch:vod] v2281234567: Unable to download webpage: HTTP Error 503: Service Unavailable").kind).toBe("transient")
    expect(downloadFailure("ERROR: unable to download video data: <urlopen error timed out>")).toEqual({ kind: "transient", message: "unable to download video data: <urlopen error timed out>" })
  })
})
