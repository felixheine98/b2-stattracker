// Reverse proxies can replace upstream failures with HTML, even for JSON APIs.
export async function readOpponentResponse<T = Record<string, unknown>>(response: Response): Promise<T> {
  if (response.redirected && /\/login\/?$/.test(new URL(response.url).pathname)) {
    throw new Error("Your session has expired. Please sign in again.")
  }
  let data: T & { error?: string }
  try { data = await response.json() } catch {
    throw new Error(response.ok
      ? "The server returned an unexpected answer. Please try again."
      : `The request failed (HTTP ${response.status}). Please try again.`)
  }
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : `The request failed (HTTP ${response.status}).`)
  return data
}
