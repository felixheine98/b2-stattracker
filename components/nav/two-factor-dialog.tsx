"use client"

import { PasskeyAdd } from "@/components/account/passkey-add"
import { TotpSetup } from "@/components/account/totp-setup"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BASE_PATH } from "@/lib/base-path"
import { Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

interface Status {
  enabled: boolean
  required: boolean
  recoveryCodesLeft: number
}

interface Passkey {
  id: string
  name: string
  createdAt: string
  lastUsedAt: string | null
}

type View = "overview" | "totp-setup" | "totp-off" | "passkey-add"

// Lets the signed-in user manage how their own account signs in beyond the password:
// codes from an authenticator app, and passkeys
export function TwoFactorDialog({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>("overview")
  const [status, setStatus] = useState<Status | null>(null)
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const [statusRes, passkeysRes] = await Promise.all([
      fetch(`${BASE_PATH}/api/account/totp`).catch(() => null),
      fetch(`${BASE_PATH}/api/account/passkeys`).catch(() => null),
    ])
    if (!statusRes?.ok || !passkeysRes?.ok) {
      setError("Failed to load")
      return
    }
    setStatus(await statusRes.json())
    setPasskeys(await passkeysRes.json())
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  function backToOverview() {
    setView("overview")
    setError("")
    setPassword("")
    load()
  }

  // An account that has to use a second factor is sent to the setup once it has none left
  function afterRemoval(left: { totp: boolean; passkeys: number }) {
    if (status?.required && !left.totp && left.passkeys === 0) window.location.assign(`${BASE_PATH}/mfa-setup`)
    else backToOverview()
  }

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
    afterRemoval({ totp: false, passkeys: passkeys.length })
  }

  async function removePasskey(passkey: Passkey) {
    if (!confirm(`Remove the passkey "${passkey.name}"? It no longer signs you in afterwards.`)) return
    const res = await fetch(`${BASE_PATH}/api/account/passkeys/${passkey.id}`, { method: "DELETE" }).catch(() => null)
    if (!res?.ok) {
      setError("Failed to remove the passkey")
      return
    }
    afterRemoval({ totp: !!status?.enabled, passkeys: passkeys.length - 1 })
  }

  if (view === "totp-setup") {
    return (
      <Dialog open onClose={onClose}>
        <DialogTitle>Authenticator app</DialogTitle>
        <TotpSetup onDone={backToOverview} onCancel={backToOverview} />
      </Dialog>
    )
  }

  if (view === "passkey-add") {
    return (
      <Dialog open onClose={onClose}>
        <DialogTitle>Add a passkey</DialogTitle>
        <PasskeyAdd onDone={backToOverview} onCancel={backToOverview} />
      </Dialog>
    )
  }

  if (view === "totp-off") {
    return (
      <Dialog open onClose={onClose}>
        <DialogTitle>Turn off the authenticator app</DialogTitle>
        <form onSubmit={turnOff} className="space-y-4">
          <p className="text-sm text-[#9a9090]">
            Codes from the app and the recovery codes stop working. To move to a new phone or get new recovery codes,
            turn it off and set it up again.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="totp-off-password">Your password</Label>
            <Input id="totp-off-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {error && <p className="text-sm text-[#ED1F24]">{error}</p>}
          <div className="dialog-footer flex gap-2 justify-end">
            <Button variant="ghost" type="button" onClick={backToOverview}>Cancel</Button>
            <Button variant="outline" type="submit" disabled={loading}>{loading ? "Turning off…" : "Turn off"}</Button>
          </div>
        </form>
      </Dialog>
    )
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Sign-in security</DialogTitle>
      {!status ? (
        <p className={error ? "text-sm text-[#ED1F24]" : "text-sm text-[#9a9090]"}>{error || "Loading…"}</p>
      ) : (
        <div className="space-y-5">
          {status.required && <p className="text-sm text-[#9a9090]">Your account has to keep at least one of the two.</p>}

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-[#f5f0f0]">Authenticator app</h3>
              {status.enabled ? (
                <Button variant="outline" size="sm" onClick={() => setView("totp-off")}>Turn off</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setView("totp-setup")}>Set up</Button>
              )}
            </div>
            <p className="text-sm text-[#9a9090]">
              {status.enabled ? (
                <>
                  <span className="text-[#FBD00D]">On</span> – signing in with your password asks for a code. {status.recoveryCodesLeft} recovery{" "}
                  {status.recoveryCodesLeft === 1 ? "code" : "codes"} left.
                </>
              ) : (
                "Off. With it, signing in with your password also asks for a code from an app on your phone."
              )}
            </p>
          </section>

          <section className="space-y-2 border-t border-[#2d2829] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-[#f5f0f0]">Passkeys</h3>
              <Button variant="outline" size="sm" onClick={() => setView("passkey-add")}>Add passkey</Button>
            </div>
            {passkeys.length === 0 ? (
              <p className="text-sm text-[#9a9090]">None yet. A passkey signs you in with your fingerprint, face or PIN, without password.</p>
            ) : (
              <ul className="divide-y divide-[#2d2829] rounded-lg border border-[#2d2829]">
                {passkeys.map((passkey) => (
                  <li key={passkey.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-[#f5f0f0]">{passkey.name}</div>
                      <div className="text-xs text-[#5e5858]">
                        Added {new Date(passkey.createdAt).toLocaleDateString()}
                        {passkey.lastUsedAt ? ` · last used ${new Date(passkey.lastUsedAt).toLocaleDateString()}` : " · not used yet"}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removePasskey(passkey)} title="Remove passkey" aria-label={`Remove passkey ${passkey.name}`} className="text-[#5e5858] hover:text-[#ED1F24]">
                      <Trash2 size={14} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {error && <p className="text-sm text-[#ED1F24]">{error}</p>}
          <div className="dialog-footer flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
