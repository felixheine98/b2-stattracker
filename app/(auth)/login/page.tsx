"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const result = await signIn("credentials", {
      login: form.get("login"),
      password: form.get("password"),
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError("Invalid username or password")
    } else {
      router.push("/dashboard")
      router.refresh()
    }
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
        No account?{" "}
        <Link href="/register" className="text-[#FBD00D] hover:text-[#e6bc0c]">
          Register
        </Link>
      </p>
    </div>
  )
}
