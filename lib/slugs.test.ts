import { describe, expect, it } from "vitest"
import { matchSlugBase, slugify, uniqueSlugs } from "./slugs"
import type { StageType } from "./stages"

describe("slugify", () => {
  it("lower-cases and joins words with hyphens", () => {
    expect(slugify("Vertigo S1")).toBe("vertigo-s1")
    expect(slugify("  B2 eSports!  ")).toBe("b2-esports")
  })

  it("writes umlauts out and drops other accents", () => {
    expect(slugify("Grün Weiß Köln")).toBe("gruen-weiss-koeln")
    expect(slugify("Équipe")).toBe("equipe")
  })

  it("is empty for a name without letters or digits", () => {
    expect(slugify("???")).toBe("")
  })
})

describe("uniqueSlugs", () => {
  it("numbers equal names, the earlier item keeping the plain one", () => {
    const slugs = uniqueSlugs([
      { id: "a", base: "b2-esports" },
      { id: "b", base: "b2-rising" },
      { id: "c", base: "b2-esports" },
      { id: "d", base: "b2-esports" },
    ])
    expect(Object.fromEntries(slugs)).toEqual({ a: "b2-esports", b: "b2-rising", c: "b2-esports-2", d: "b2-esports-3" })
  })

  it("keeps clear of reserved and already numbered names", () => {
    const slugs = uniqueSlugs([{ id: "a", base: "matches" }, { id: "b", base: "x-2" }, { id: "c", base: "x" }, { id: "d", base: "x" }], ["matches"])
    expect(Object.fromEntries(slugs)).toEqual({ a: "matches-2", b: "x-2", c: "x", d: "x-3" })
  })

  it("falls back to a placeholder for an empty name", () => {
    expect(uniqueSlugs([{ id: "a", base: "" }], [], "lineup").get("a")).toBe("lineup")
  })
})

describe("matchSlugBase", () => {
  const stage = (type: StageType, number: number) => ({ type, number })
  const stages = [stage("SEEDING", 1), stage("GROUP", 1), stage("GROUP", 2), stage("PLAYOFF", 1)]

  it("is the stage plus the opponent", () => {
    expect(matchSlugBase(stage("GROUP", 1), stages, "Onyx White")).toBe("md1-vs-onyx-white")
    expect(matchSlugBase(stage("PLAYOFF", 1), stages, "PIWO Main")).toBe("playoffs-vs-piwo-main")
  })

  it("numbers the playoffs only when there are several days", () => {
    expect(matchSlugBase(stage("PLAYOFF", 2), [...stages, stage("PLAYOFF", 2)], "OCD")).toBe("playoffs-2-vs-ocd")
  })

  it("is just the stage for a seeding or a match without opponent", () => {
    expect(matchSlugBase(stage("SEEDING", 1), stages, "ignored")).toBe("seeding")
    expect(matchSlugBase(stage("GROUP", 2), stages, null)).toBe("md2")
  })
})
