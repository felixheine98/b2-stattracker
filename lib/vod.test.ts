import { describe, expect, it } from "vitest"
import { formatVodTime, rangeError, readVod, twitchVideoId, vodStart } from "./vod"

describe("VOD links", () => {
  it("recognise a Twitch VOD and keep its timestamp", () => {
    expect(readVod("https://www.twitch.tv/videos/2281234567?t=1h02m30s")).toEqual({ url: "https://www.twitch.tv/videos/2281234567?t=1h02m30s", source: "twitch" })
  })

  it("recognise YouTube and other video links", () => {
    expect(readVod("https://youtu.be/dQw4w9WgXcQ?t=95")?.source).toBe("youtube")
    expect(readVod("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.source).toBe("youtube")
    expect(readVod("https://clips.twitch.tv/SomeClipName")?.source).toBe("twitch")
    expect(readVod("https://kick.com/b2/videos/abc")?.source).toBe("video")
  })

  it("accept a link without https, but nothing that is not a web link", () => {
    expect(readVod("  twitch.tv/videos/123 ")).toEqual({ url: "https://twitch.tv/videos/123", source: "twitch" })
    expect(readVod("javascript:alert(1)")).toBeNull()
    expect(readVod("not a link")).toBeNull()
    expect(readVod("")).toBeNull()
    // A host that only ends like Twitch is not Twitch
    expect(readVod("https://faketwitch.tv/videos/1")?.source).toBe("video")
  })
})

describe("VOD ranges", () => {
  it("read the start from a Twitch timestamp", () => {
    expect(vodStart("https://www.twitch.tv/videos/2281234567?t=1h02m30s")).toBe(3750)
    expect(vodStart("https://www.twitch.tv/videos/2281234567?t=95s")).toBe(95)
    expect(vodStart("https://www.twitch.tv/videos/2281234567?t=2m")).toBe(120)
    expect(vodStart("https://www.twitch.tv/videos/2281234567")).toBeNull()
    expect(vodStart("https://www.twitch.tv/videos/2281234567?t=soon")).toBeNull()
  })

  it("find the Twitch video a range can be set on: VODs and highlights, not clips or channels", () => {
    expect(twitchVideoId("https://www.twitch.tv/videos/2281234567?t=1h02m30s")).toBe("2281234567")
    expect(twitchVideoId("https://m.twitch.tv/videos/2281234567")).toBe("2281234567")
    expect(twitchVideoId("https://clips.twitch.tv/SomeClipName")).toBeNull()
    expect(twitchVideoId("https://www.twitch.tv/b2esports")).toBeNull()
    expect(twitchVideoId("https://youtu.be/abc")).toBeNull()
  })

  it("show a point in the VOD as h:mm:ss, or m:ss below an hour", () => {
    expect(formatVodTime(3750)).toBe("1:02:30")
    expect(formatVodTime(95)).toBe("1:35")
    expect(formatVodTime(0)).toBe("0:00")
    expect(formatVodTime(36000)).toBe("10:00:00")
    // Player positions come with fractions
    expect(formatVodTime(59.9)).toBe("0:59")
  })

  it("accept a range that starts before it ends and lies within the VOD", () => {
    expect(rangeError(3750, 6490, 10800)).toBeNull()
    // The length is not always known (on the server)
    expect(rangeError(3750, 6490)).toBeNull()
    expect(rangeError(6490, 3750, 10800)).toMatch(/before/)
    expect(rangeError(3750, 3750)).toMatch(/before/)
    expect(rangeError(-5, 100)).toMatch(/start/i)
    expect(rangeError(3750, 11000, 10800)).toMatch(/longer than the VOD/)
    // A match is not a whole day
    expect(rangeError(0, 6 * 3600 + 1)).toMatch(/6 hours/)
  })
})
