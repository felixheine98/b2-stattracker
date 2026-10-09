"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BASE_PATH } from "@/lib/base-path"
import { useState } from "react"

// Letters and digits that are hard to mix up when read out or typed in
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function randomPassword(length = 14): string {
  const values = crypto.getRandomValues(new Uint32Array(length))
  return Array.from(values, (v) => ALPHABET[v % ALPHABET.length]).join("")
}

interface Props {
  user: { id: string; name: string; username: string }
  onClose: () => void
}

// Set a new password for someone else's account. It is shown in clear text, because the
// person resetting it has to pass it on.
export function ResetPasswordDialog({ user, onClose }: Props) {
  const [password, setPassword] = useState(() => randomPassword())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  async function save() {
    setError("")
    setLoading(true)
    const res = await fetch(`${BASE_PATH}/api/admin/users/${user.id}/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null)
    setLoading(false)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      setError(data?.error ?? "Passwort konnte nicht gesetzt werden")
      return
    }
    setSaved(true)
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Passwort zurücksetzen</DialogTitle>
      <div className="space-y-4">
        <p className="text-sm text-[#9a9090]">
          Neues Passwort für <span className="text-[#f5f0f0]">{user.name}</span> ({user.username}). Das bisherige gilt danach nicht mehr.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="reset-password">Neues Passwort</Label>
          <div className="flex gap-2">
            <Input
              id="reset-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setSaved(false) }}
              readOnly={saved}
              autoComplete="off"
              className="font-mono"
            />
            {!saved && (
              <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>Neu würfeln</Button>
            )}
          </div>
        </div>
        {saved && (
          <p className="text-sm text-[#FBD00D]">
            Gespeichert. Gib das Passwort jetzt weiter – es wird nach dem Schließen nicht mehr angezeigt.
          </p>
        )}
        {error && <p className="text-sm text-[#ED1F24]">{error}</p>}
        <div className="dialog-footer flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>{saved ? "Schließen" : "Abbrechen"}</Button>
          {!saved && <Button onClick={save} disabled={loading || password.length < 8}>{loading ? "Speichert…" : "Passwort setzen"}</Button>}
        </div>
      </div>
    </Dialog>
  )
}
