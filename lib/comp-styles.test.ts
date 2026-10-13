import { describe, expect, it } from "vitest"
import { filterByStyle, needsFormats, parseStyle, styleLabel, styleParam, stylesInUse } from "./comp-styles"

describe("parseStyle", () => {
  it("reads the style from the address, whatever its case", () => {
    expect(parseStyle("ice")).toBe("ICE")
    expect(parseStyle("Endurance")).toBe("ENDURANCE")
  })

  it("is no style for a missing, repeated or unknown value", () => {
    expect(parseStyle(undefined)).toBeNull()
    expect(parseStyle(["ice", "tech"])).toBeNull()
    expect(parseStyle("snow")).toBeNull()
    expect(parseStyle("")).toBeNull()
  })
})

describe("stylesInUse", () => {
  it("names each style that has a tournament once, in the fixed order", () => {
    expect(stylesInUse([{ style: "MIXED" }, { style: "ENDURANCE" }, { style: "TECH" }, { style: "MIXED" }])).toEqual(["TECH", "ENDURANCE", "MIXED"])
  })

  it("is empty without tournaments", () => {
    expect(stylesInUse([])).toEqual([])
  })
})

describe("filterByStyle", () => {
  const list = [{ name: "MTS S1", style: "TECH" as const }, { name: "EMC S8", style: "MIXED" as const }, { name: "MTS Fall 2024", style: "TECH" as const }]

  it("keeps the tournaments of the style, in their order", () => {
    expect(filterByStyle(list, "TECH").map((t) => t.name)).toEqual(["MTS S1", "MTS Fall 2024"])
    expect(filterByStyle(list, "ICE")).toEqual([])
  })

  it("keeps all of them without a style", () => {
    expect(filterByStyle(list, null)).toEqual(list)
  })
})

describe("styleLabel and styleParam", () => {
  it("names a style for the page and for the address", () => {
    expect(styleLabel("RPG")).toBe("RPG")
    expect(styleLabel("FULLSPEED")).toBe("Fullspeed")
    expect(styleParam("FULLSPEED")).toBe("fullspeed")
    expect(parseStyle(styleParam("ENDURANCE"))).toBe("ENDURANCE")
  })
})

describe("needsFormats", () => {
  it("asks every tournament for formats but an endurance race", () => {
    expect(needsFormats("ENDURANCE")).toBe(false)
    expect(needsFormats("RPG")).toBe(true)
    expect(needsFormats("MIXED")).toBe(true)
  })
})
