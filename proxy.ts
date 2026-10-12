import { BASE_PATH } from "@/lib/base-path"
import { auth } from "@/lib/auth"
import { loginPath, nextPathAfterLogin } from "@/lib/login-target"
import { NextResponse } from "next/server"

const BASE = BASE_PATH

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  // pathname may or may not include basePath depending on Next.js 16 proxy internals
  const stripped = pathname.startsWith(BASE) ? pathname.slice(BASE.length) || "/" : pathname

  const isPublicApi = stripped.startsWith("/api/auth")
  const isAuthPage = stripped === "/login"

  if (isPublicApi) return NextResponse.next()

  if (!isLoggedIn && !isAuthPage) {
    // The login remembers the page, so a shared link still leads there after signing in
    return NextResponse.redirect(new URL(`${BASE}${loginPath(stripped, req.nextUrl.search)}`, req.nextUrl.origin))
  }

  // An account that has to use two-factor sign-in gets nowhere else until it is set up
  const isMfaSetup = stripped === "/mfa-setup" || stripped.startsWith("/api/account/totp")
  if (isLoggedIn && req.auth?.user?.mfaSetupRequired && !isMfaSetup) {
    if (stripped.startsWith("/api/")) return NextResponse.json({ error: "Set up two-factor sign-in first" }, { status: 403 })
    return NextResponse.redirect(new URL(`${BASE}/mfa-setup`, req.nextUrl.origin))
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL(`${BASE}${nextPathAfterLogin(req.nextUrl.searchParams.get("next"))}`, req.nextUrl.origin))
  }

  return NextResponse.next()
})

export const config = {
  // Static assets (icons, logos, flags, manifest) must be reachable without a session
  matcher: ["/((?!_next/static|_next/image|manifest.webmanifest|.*\\.(?:ico|svg|png)$).*)"],
}
