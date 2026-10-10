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

it("follows Google image redirects and still copies the image", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://lh7-rt.googleusercontent.com/rd-sheets-images-rt/logo" } }))
    .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } }))
  vi.stubGlobal("fetch", fetcher)
  expect(await copySheetLogo("https://docs.google.com/sheets-images-rt/logo")).toBe("data:image/png;base64,AQID")
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it("rejects redirects outside Google's spreadsheet image hosts before fetching them", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://example.com/private" } }))
  vi.stubGlobal("fetch", fetcher)
  await expect(copySheetLogo("https://docs.google.com/sheets-images-rt/logo")).rejects.toThrow("Unbekannte Logoquelle")
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it("bounds redirect loops", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://docs.google.com/sheets-images-rt/loop" } }))
  vi.stubGlobal("fetch", fetcher)
  await expect(copySheetLogo("https://docs.google.com/sheets-images-rt/logo")).rejects.toThrow("Weiterleitungen")
  expect(fetcher.mock.calls.length).toBeLessThanOrEqual(4)
})
