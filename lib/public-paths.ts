// What can be reached without signing in (paths without the base path): the sign-in itself, the
// challenge a passkey sign-in starts with, and the privacy policy Google links to (docs/adr/011)
export function isPublicPath(path: string): boolean {
  return path.startsWith("/api/auth") || path === "/api/passkey/options" || path === "/privacy" || path === "/api/internal/feedback"
}
