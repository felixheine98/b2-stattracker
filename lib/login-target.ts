// Where someone ends up after signing in. Whoever opens a link without being signed in is
// sent to the login with the page they wanted (?next=...), and from there on to that page.
// All paths here are without the base path, as Next.js routes them.

const DEFAULT = "/dashboard"

// The login address for someone who was sent away from the given page
export function loginPath(pathname: string, search: string): string {
  const wanted = pathname + search
  if (pathname === "/" || pathname === DEFAULT || pathname.startsWith("/api/")) return "/login"
  return `/login?next=${encodeURIComponent(wanted)}`
}

// The page to open after signing in: the one asked for if it is a page of this app, otherwise
// the dashboard. The value comes from the address, so anything that could lead elsewhere is refused.
export function nextPathAfterLogin(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return DEFAULT
  const path = next.split(/[?#]/)[0]
  if (path === "/login" || path.startsWith("/api/")) return DEFAULT
  return next
}
