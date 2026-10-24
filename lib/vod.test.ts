import { describe, expect, it } from "vitest"
import { readVod } from "./vod"

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
