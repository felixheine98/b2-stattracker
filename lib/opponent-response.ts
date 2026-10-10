// Reverse proxies can replace upstream failures with HTML, even for JSON APIs.
export async function readOpponentResponse<T = Record<string, unknown>>(response: Response): Promise<T> {
  if (response.redirected && /\/login\/?$/.test(new URL(response.url).pathname)) {
    throw new Error("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.")
  }
  let data: T & { error?: string }
  try { data = await response.json() } catch {
    throw new Error(response.ok
      ? "Der Server hat eine unerwartete Antwort geliefert. Bitte erneut versuchen."
      : `Die Anfrage ist fehlgeschlagen (HTTP ${response.status}). Bitte erneut versuchen.`)
  }
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : `Die Anfrage ist fehlgeschlagen (HTTP ${response.status}).`)
  return data
}
