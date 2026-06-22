import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

const BASE = "/b2-stats"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  // pathname may or may not include basePath depending on Next.js 16 proxy internals
  const stripped = pathname.startsWith(BASE) ? pathname.slice(BASE.length) || "/" : pathname

  const isPublicApi = stripped.startsWith("/api/auth") || stripped.startsWith("/api/register")
  const isAuthPage = stripped === "/login" || stripped === "/register"

  if (isPublicApi) return NextResponse.next()

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL(`${BASE}/login`, req.nextUrl.origin))
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL(`${BASE}/dashboard`, req.nextUrl.origin))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
