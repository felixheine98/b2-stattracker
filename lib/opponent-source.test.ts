import { afterEach, describe, expect, it, vi } from "vitest"
import { copySheetLogo } from "./opponent-source"
afterEach(() => vi.unstubAllGlobals())
describe("spreadsheet logo copy", () => {
  it("copies an allowed image instead of storing a temporary Google URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } })))
    expect(await copySheetLogo("https://docs.google.com/sheets-images-rt/logo")).toBe("data:image/png;base64,AQID")
  })
  it("rejects arbitrary URLs and non-image responses", async () => {
    await expect(copySheetLogo("http://localhost/private")).rejects.toThrow()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not an image", { headers: { "content-type": "text/html" } })))
    await expect(copySheetLogo("https://docs.google.com/sheets-images-rt/logo")).rejects.toThrow()
  })
})
