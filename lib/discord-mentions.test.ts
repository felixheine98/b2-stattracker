import { describe, expect, it } from "vitest"
import { compRoles, searchRoles, toDiscordMentions } from "./discord-mentions"

const role = (id: string, name: string) => ({ id, name, mentionable: false, color: null })
const roles = [role("1", "Manager"), role("2", "Vertigo Main"), role("3", "Vertigo Rising"), role("4", "Blitz Rising"), role("5", "TFH"), role("6", "RPG")]

describe("mentions in an announcement", () => {
  it("offers the roles named like the comp, the lineup's own first", () => {
    expect(compRoles(roles, "Vertigo S1", "B2 Rising").map((r) => r.name)).toEqual(["Vertigo Rising", "Vertigo Main"])
    expect(compRoles(roles, "TFH 12h RPG #2", "B2 eSports").map((r) => r.name)).toEqual(["TFH", "RPG"])
    // A word of the lineup alone does not make a role the comp's
    expect(compRoles(roles, "Omnium S1", "B2 Rising")).toEqual([])
  })

  it("finds any role by a part of its name", () => {
    expect(searchRoles("ris", roles).map((r) => r.name)).toEqual(["Vertigo Rising", "Blitz Rising"])
    expect(searchRoles("", roles)).toEqual(roles)
  })

  it("turns the @names shown in the text into Discord's mentions when posting", () => {
    const mentions = [
      { label: "@Vertigo Rising", raw: "<@&3>" },
      { label: "@Vertigo", raw: "<@&9>" },
      { label: "@Anna", raw: "<@101>" },
    ]
    expect(toDiscordMentions("@Vertigo Rising who is there? @Anna, @Vertigo", mentions)).toBe("<@&3> who is there? <@101>, <@&9>")
    // Names that were not inserted as a mention stay text
    expect(toDiscordMentions("@Ben and mail@Anna.de", mentions)).toBe("@Ben and mail@Anna.de")
  })
})
