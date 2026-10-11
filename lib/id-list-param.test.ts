import { describe, expect, it } from "vitest"
import { parseIdList, serializeIdList } from "./id-list-param"

const valid = ["a", "b", "c"]

describe("parseIdList", () => {
  it("reads the selected IDs and drops unknown ones", () => {
    expect(parseIdList("a,c,gone", valid, [])).toEqual(["a", "c"])
  })

  it("uses the default selection while nothing is chosen in the address", () => {
    expect(parseIdList(null, valid, ["b"])).toEqual(["b"])
    expect(parseIdList(null, valid, [])).toEqual([])
  })

  it("keeps an explicit choice of everything apart from the default", () => {
    expect(parseIdList("all", valid, ["b"])).toEqual([])
  })
})

describe("serializeIdList", () => {
  it("writes the selected IDs", () => {
    expect(serializeIdList(["a", "c"], [])).toBe("a,c")
  })

  it("writes nothing for an empty selection without a default", () => {
    expect(serializeIdList([], [])).toBeNull()
  })

  it("marks an empty selection when a default would otherwise take over again", () => {
    expect(serializeIdList([], ["b"])).toBe("all")
  })

  it("writes nothing when the selection is the default anyway", () => {
    expect(serializeIdList(["b"], ["b"])).toBeNull()
  })
})
