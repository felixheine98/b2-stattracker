"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const res = await fetch("/b2-stats/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        username: form.get("username"),
        email: form.get("email"),
        password: form.get("password"),
      }),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Registration failed")
      return
    }

    router.push("/login")
  }

  return (
    <div className="rounded-xl border border-[#2d2829] bg-[#1c1819] p-6">
      <h2 className="text-lg font-semibold text-[#f5f0f0] mb-5">Create account</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Display name</Label>
          <Input id="name" name="name" type="text" autoComplete="name" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input id="username" name="username" type="text" autoComplete="username" pattern="[a-zA-Z0-9_.\-]+" minLength={3} required />
          <p className="text-xs text-[#5e5858]">Letters, numbers, underscores, dots, hyphens</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email <span className="text-[#5e5858]">(optional)</span></Label>
          <Input id="email" name="email" type="email" autoComplete="email" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>
        {error && <p className="text-sm text-[#ED1F24]">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-[#5e5858]">
        Already have an account?{" "}
        <Link href="/login" className="text-[#FBD00D] hover:text-[#e6bc0c]">
          Sign in
        </Link>
      </p>
    </div>
  )
}
