import { describe, expect, it } from "vitest"
import { readOpponentResponse } from "./opponent-response"
describe("opponent request responses", () => {
  it("reads successful JSON", async () => {
    expect(await readOpponentResponse(Response.json({ id: "team" }))).toEqual({ id: "team" })
  })
  it("keeps the server's actionable error", async () => {
    await expect(readOpponentResponse(Response.json({ error: "Die Logoquelle ist nicht erreichbar." }, { status: 502 }))).rejects.toThrow("Die Logoquelle ist nicht erreichbar.")
  })
  it("explains a proxy HTML error without showing HTML or a JSON parse error", async () => {
    await expect(readOpponentResponse(new Response("<html>Bad Gateway</html>", { status: 502 }))).rejects.toThrow("HTTP 502")
  })
  it("asks for login when an expired session was redirected to HTML", async () => {
    const response = new Response("<html>Login</html>")
    Object.defineProperty(response, "url", { value: "https://example.com/stats/login" })
    Object.defineProperty(response, "redirected", { value: true })
    await expect(readOpponentResponse(response)).rejects.toThrow("session")
  })
  it("handles an unexpected successful HTML response", async () => {
    await expect(readOpponentResponse(new Response("<html>Unexpected</html>"))).rejects.toThrow("unexpected answer")
  })
})
