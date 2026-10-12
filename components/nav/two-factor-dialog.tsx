"use client"

import { TotpSetup } from "@/components/account/totp-setup"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BASE_PATH } from "@/lib/base-path"
import { useEffect, useState } from "react"

interface Status {
  enabled: boolean
  required: boolean
  recoveryCodesLeft: number
}

// Lets the signed-in user turn two-factor sign-in on or off for their own account
export function TwoFactorDialog({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`${BASE_PATH}/api/account/totp`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setStatus)
      .catch(() => setError("Failed to load"))
  }, [])

  async function turnOff(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const res = await fetch(`${BASE_PATH}/api/account/totp`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null)
    setLoading(false)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      setError(data?.error ?? "Failed to turn it off")
      return
    }
    // An account that has to use it is sent to the setup again
    if (status?.required) window.location.assign(`${BASE_PATH}/mfa-setup`)
    else onClose()
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Two-factor sign-in</DialogTitle>
      {!status ? (
        <p className={error ? "text-sm text-[#ED1F24]" : "text-sm text-[#9a9090]"}>{error || "Loading…"}</p>
      ) : !status.enabled ? (
        <TotpSetup onDone={onClose} onCancel={onClose} />
      ) : (
        <form onSubmit={turnOff} className="space-y-4">
          <p className="text-sm text-[#c5bfbf]">
            Two-factor sign-in is <span className="text-[#FBD00D]">on</span>. You have {status.recoveryCodesLeft} recovery{" "}
            {status.recoveryCodesLeft === 1 ? "code" : "codes"} left.
          </p>
          <p className="text-sm text-[#9a9090]">
            {status.required
              ? "Your account has to use it. To move to a new phone or get new recovery codes, turn it off here and set it up again right after."
              : "To move to a new phone or get new recovery codes, turn it off and set it up again."}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="totp-off-password">Password</Label>
            <Input id="totp-off-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {error && <p className="text-sm text-[#ED1F24]">{error}</p>}
          <div className="dialog-footer flex gap-2 justify-end">
            <Button variant="ghost" type="button" onClick={onClose}>Close</Button>
            <Button variant="outline" type="submit" disabled={loading}>{loading ? "Turning off…" : "Turn off"}</Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
