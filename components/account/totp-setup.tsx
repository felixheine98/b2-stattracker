"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BASE_PATH } from "@/lib/base-path"
import { useState } from "react"

interface Props {
  // Called once the recovery codes have been shown and put away
  onDone: () => void
  // Leaves the setup before it is finished; without it there is no way around
  onCancel?: () => void
}

// Sets up two-factor sign-in for the signed-in account: scan the QR code with an authenticator
// app, confirm with a code from it, then note the recovery codes.
export function TotpSetup({ onDone, onCancel }: Props) {
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null)
  const [code, setCode] = useState("")
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  async function post(path: string, body?: unknown) {
    setError("")
    setLoading(true)
    const res = await fetch(`${BASE_PATH}/api/account/totp/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    setLoading(false)
    if (!res?.ok) {
      setError(data?.error ?? "That did not work. Try again.")
      return null
    }
    return data
  }

  async function start() {
    const data = await post("setup")
    if (data) setSetup(data)
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    const data = await post("enable", { code })
    if (data) setRecoveryCodes(data.recoveryCodes)
  }

  async function copyCodes() {
    await navigator.clipboard.writeText(recoveryCodes!.join("\n")).catch(() => null)
    setCopied(true)
  }

  if (recoveryCodes) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[#c5bfbf]">
          Two-factor sign-in is on. Keep these recovery codes somewhere safe: each one signs you in once if you do
          not have your phone. They are not shown again.
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border border-[#2d2829] bg-[#0e0b0b] p-3 font-mono text-sm text-[#f5f0f0]">
          {recoveryCodes.map((c) => <span key={c}>{c}</span>)}
        </div>
        <div className="dialog-footer flex flex-wrap gap-2 justify-end">
          <Button variant="outline" type="button" onClick={copyCodes}>{copied ? "Copied" : "Copy codes"}</Button>
          <Button type="button" onClick={onDone}>I have saved them</Button>
        </div>
      </div>
    )
  }

  if (!setup) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[#c5bfbf]">
          With two-factor sign-in you need your password and a code from an authenticator app on your phone
          (Google Authenticator, Aegis, 1Password, …) to sign in.
        </p>
        {error && <p className="text-sm text-[#ED1F24]">{error}</p>}
        <div className="dialog-footer flex gap-2 justify-end">
          {onCancel && <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>}
          <Button type="button" onClick={start} disabled={loading}>{loading ? "Starting…" : "Set up"}</Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={confirm} className="space-y-4">
      <p className="text-sm text-[#c5bfbf]">Scan the QR code with your authenticator app, or type the key in by hand.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={setup.qr} alt="QR code for the authenticator app" width={220} height={220} className="mx-auto rounded-lg" />
      <p className="break-all text-center font-mono text-xs text-[#9a9090]">{setup.secret.match(/.{1,4}/g)?.join(" ")}</p>
      <div className="space-y-1.5">
        <Label htmlFor="totp-confirm">Code from the app</Label>
        <Input
          id="totp-confirm"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          maxLength={7}
          className="font-mono tracking-widest"
          required
        />
      </div>
      {error && <p className="text-sm text-[#ED1F24]">{error}</p>}
      <div className="dialog-footer flex gap-2 justify-end">
        {onCancel && <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={loading}>{loading ? "Checking…" : "Turn on"}</Button>
      </div>
    </form>
  )
}
