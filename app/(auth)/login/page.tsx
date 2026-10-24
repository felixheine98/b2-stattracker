"use client"

import Link from "next/link"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser"
import { BASE_PATH } from "@/lib/base-path"
import { useRouter } from "next/navigation"
import { nextPathAfterLogin } from "@/lib/login-target"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { KeyRound } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  // Set once the password was right and the account asks for its second step
  const [credentials, setCredentials] = useState<{ login: string; password: string } | null>(null)
  const [useRecoveryCode, setUseRecoveryCode] = useState(false)

  // Back to the page the link pointed to, if someone was sent here from one
  function enter() {
    router.push(nextPathAfterLogin(new URLSearchParams(window.location.search).get("next")))
    router.refresh()
  }

  // Without password: the device offers its passkeys for this site and signs the challenge
  async function handlePasskey() {
    setError("")
    if (!browserSupportsWebAuthn()) {
      setError("This browser does not support passkeys")
      return
    }
    setLoading(true)
    const options = await fetch(`${BASE_PATH}/api/passkey/options`, { method: "POST" }).then((res) => (res.ok ? res.json() : null)).catch(() => null)
    const response = options && (await startAuthentication(options).catch(() => null))
    if (!response) {
      setLoading(false)
      if (!options) setError("Passkey sign-in is not available right now")
      return
    }
    const result = await signIn("credentials", { passkey: JSON.stringify(response), redirect: false })
    setLoading(false)
    if (result?.error) setError("This passkey is not known here")
    else enter()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const given = credentials ?? { login: String(form.get("login")), password: String(form.get("password")) }
    const result = await signIn("credentials", {
      ...given,
      ...(credentials && { code: String(form.get("code")) }),
      redirect: false,
    })

    setLoading(false)

    if (result?.code === "totp_required") {
      setCredentials(given)
    } else if (result?.code === "totp_invalid") {
      setError(useRecoveryCode ? "This recovery code is not valid" : "The code is not correct")
    } else if (result?.code === "totp_locked") {
      setError("Too many wrong codes. Try again in 15 minutes.")
    } else if (result?.code === "passkey_required") {
      setError("This account signs in with a passkey")
    } else if (result?.error) {
      setCredentials(null)
      setError("Invalid username or password")
    } else {
      enter()
    }
  }

  if (credentials) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-lg font-semibold text-fg mb-5">Two-factor sign-in</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">{useRecoveryCode ? "Recovery code" : "Code from your authenticator app"}</Label>
            {useRecoveryCode ? (
              <Input key="recovery" id="code" name="code" type="text" autoComplete="off" autoCapitalize="none" placeholder="xxxxx-xxxxx" maxLength={20} className="font-mono" autoFocus required />
            ) : (
              <Input key="totp" id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={7} className="font-mono tracking-widest" autoFocus required />
            )}
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap justify-between gap-x-4 gap-y-2 text-sm text-fg-subtle">
          <button type="button" onClick={() => { setUseRecoveryCode((v) => !v); setError("") }} className="hover:text-fg">
            {useRecoveryCode ? "Use a code from the app" : "Use a recovery code"}
          </button>
          <button type="button" onClick={() => { setCredentials(null); setUseRecoveryCode(false); setError("") }} className="hover:text-fg">
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold text-fg mb-5">Sign in</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login">Username or email</Label>
          <Input id="login" name="login" type="text" autoComplete="username" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={handlePasskey} disabled={loading}>
          <KeyRound size={16} />
          Sign in with a passkey
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-fg-subtle">
        No account? Ask an admin or manager to create one.
      </p>
      <p className="mt-3 text-center text-xs">
        <Link href="/privacy" className="text-fg-subtle hover:text-fg">Privacy policy</Link>
      </p>
    </div>
  )
}
