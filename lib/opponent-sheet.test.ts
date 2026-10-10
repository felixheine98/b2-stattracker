import { describe, expect, it } from "vitest"
import { parseTeamSheet, findSheetBlock, sourcePreviewExclusions } from "./opponent-sheet"

const html = `<table class="waffle"><tbody>
<tr><th>1</th><td colspan="3"><img src="https://docs.google.com/sheets-images-rt/logo-a"></td><td></td><td colspan="3"><img src="https://docs.google.com/sheets-images-rt/logo-b"></td></tr>
<tr><th>2</th><td colspan="3">Team A</td><td></td><td colspan="3">Team B</td></tr>
<tr><th>3</th><td>DE</td><td><img src="https://trackmania.io/img/flags/de.jpg"></td><td>Speedy</td><td></td><td>FR</td><td></td><td>Other</td></tr>
<tr><th>4</th><td>AT</td><td></td><td>Racer</td><td></td><td></td><td></td><td></td></tr>
<tr><th>5</th><td colspan="3"><img src="https://docs.google.com/sheets-images-rt/logo-c"></td></tr>
<tr><th>6</th><td colspan="3">Team A Academy</td></tr>
<tr><th>7</th><td>GB</td><td></td><td>Youngster</td></tr></tbody></table>`

describe("team spreadsheet blocks", () => {
  it("reads merged cells and separate adjacent blocks with their logo and members", () => {
    const blocks = parseTeamSheet(html)
    expect(blocks).toHaveLength(3)
    expect(blocks.find(b => b.name === "Team A")).toMatchObject({ logoUrl: "https://docs.google.com/sheets-images-rt/logo-a", members: [{ name: "Speedy", country: "de" }, { name: "Racer", country: "at" }] })
    expect(blocks.find(b => b.name === "Team B")?.members.map(m => m.name)).toEqual(["Other"])
    expect(blocks.find(b => b.name === "Team A Academy")?.members.map(m => m.name)).toEqual(["Youngster"])
  })
  it("finds a moved block by name and refuses ambiguous names, never trusting an old cell address", () => {
    const blocks = parseTeamSheet(html)
    expect(findSheetBlock(blocks, "team a")?.name).toBe("Team A")
    expect(findSheetBlock([...blocks, { ...blocks[0], key: "elsewhere" }], blocks[0].name)).toBeNull()
  })
  it("rejects unreadable layouts rather than presenting a successful empty import", () => {
    expect(() => parseTeamSheet("<html>Login required</html>")).toThrow()
  })
  it("reads the source's rowspan headers and br-separated names without shifting columns", () => {
    const blocks = parseTeamSheet(`<table class="waffle"><tbody>
    <tr><th>94</th><td></td><td rowspan="3"><img src="https://docs.google.com/sheets-images-rt/b2"></td><td rowspan="3">B2<br>eSports</td><td></td><td></td><td rowspan="3"><img src="https://docs.google.com/sheets-images-rt/bv"></td><td rowspan="3">Baltic<br>Vikings</td></tr>
    <tr><th>95</th><td></td><td></td><td></td></tr><tr><th>96</th><td></td><td></td><td></td></tr>
    <tr><th>97</th><td>DE</td><td></td><td>Speedy</td><td></td><td>LT</td><td></td><td>Other</td></tr>
    </tbody></table>`)
    expect(blocks.find(b => b.name === "B2 eSports")?.members).toEqual([{ name: "Speedy", country: "de" }])
    expect(blocks.find(b => b.name === "Baltic Vikings")?.members).toEqual([{ name: "Other", country: "lt" }])
  })
  it("remembers deliberately excluded source members while offering genuinely new names", () => {
    const blocks = parseTeamSheet(html)
    const old = { blocks: [{ name: "Team A", members: [{ name: "Speedy", country: "de" }, { name: "Racer", country: "at" }] }], selection: [{ blockName: "Team A", name: "Speedy" }] }
    expect(sourcePreviewExclusions(blocks, old)).toEqual([`${blocks[0].key}:Racer`])
    expect(sourcePreviewExclusions(blocks, null)).toEqual([])
  })
})
