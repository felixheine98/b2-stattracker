"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { nextPathAfterLogin } from "@/lib/login-target"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  // Set once the password was right and the account asks for its second step
  const [credentials, setCredentials] = useState<{ login: string; password: string } | null>(null)
  const [useRecoveryCode, setUseRecoveryCode] = useState(false)

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
    } else if (result?.error) {
      setCredentials(null)
      setError("Invalid username or password")
    } else {
      // Back to the page the link pointed to, if someone was sent here from one
      router.push(nextPathAfterLogin(new URLSearchParams(window.location.search).get("next")))
      router.refresh()
    }
  }

  if (credentials) {
    return (
      <div className="rounded-xl border border-[#2d2829] bg-[#1c1819] p-6">
        <h2 className="text-lg font-semibold text-[#f5f0f0] mb-5">Two-factor sign-in</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">{useRecoveryCode ? "Recovery code" : "Code from your authenticator app"}</Label>
            {useRecoveryCode ? (
              <Input key="recovery" id="code" name="code" type="text" autoComplete="off" autoCapitalize="none" placeholder="xxxxx-xxxxx" maxLength={20} className="font-mono" autoFocus required />
            ) : (
              <Input key="totp" id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={7} className="font-mono tracking-widest" autoFocus required />
            )}
          </div>
          {error && <p className="text-sm text-[#ED1F24]">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap justify-between gap-x-4 gap-y-2 text-sm text-[#5e5858]">
          <button type="button" onClick={() => { setUseRecoveryCode((v) => !v); setError("") }} className="hover:text-[#f5f0f0]">
            {useRecoveryCode ? "Use a code from the app" : "Use a recovery code"}
          </button>
          <button type="button" onClick={() => { setCredentials(null); setUseRecoveryCode(false); setError("") }} className="hover:text-[#f5f0f0]">
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#2d2829] bg-[#1c1819] p-6">
      <h2 className="text-lg font-semibold text-[#f5f0f0] mb-5">Sign in</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login">Username or email</Label>
          <Input id="login" name="login" type="text" autoComplete="username" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {error && <p className="text-sm text-[#ED1F24]">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-[#5e5858]">
        No account? Ask an admin or manager to create one.
      </p>
    </div>
  )
}
