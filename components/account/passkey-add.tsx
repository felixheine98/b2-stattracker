"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BASE_PATH } from "@/lib/base-path"
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser"
import { useState } from "react"

interface Props {
  onDone: () => void
  onCancel?: () => void
}

// Adds a passkey to the signed-in account: the device creates it after its owner unlocked it
// (fingerprint, face, PIN). From then on it signs in without password.
export function PasskeyAdd({ onDone, onCancel }: Props) {
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function post(path: string, body: unknown) {
    const res = await fetch(`${BASE_PATH}/api/account/passkeys${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    if (!res?.ok) throw new Error(data?.error ?? "That did not work. Try again.")
    return data
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!browserSupportsWebAuthn()) {
      setError("This browser does not support passkeys")
      return
    }
    setLoading(true)
    try {
      const options = await post("/options", { password })
      const response = await startRegistration(options).catch((err: Error) => {
        throw new Error(err.name === "InvalidStateError" ? "This device already has a passkey for your account" : "No passkey was created")
      })
      await post("", { name, response })
      onDone()
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-fg-soft">
        A passkey lives on your device or in your password manager and signs you in with your fingerprint, face or
        PIN – without password and without a code.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="passkey-name">Name</Label>
        <Input id="passkey-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. iPhone, laptop, YubiKey" maxLength={60} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="passkey-password">Your password</Label>
        <Input id="passkey-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="dialog-footer flex gap-2 justify-end">
        {onCancel && <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={loading}>{loading ? "Waiting for the device…" : "Create passkey"}</Button>
      </div>
    </form>
  )
}
