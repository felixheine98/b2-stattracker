"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BASE_PATH } from "@/lib/base-path"
import { useState } from "react"

// Lets the signed-in user change their own password
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("")
  const [password, setPassword] = useState("")
  const [repeat, setRepeat] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== repeat) {
      setError("Die beiden neuen Passwörter stimmen nicht überein")
      return
    }
    setError("")
    setLoading(true)
    const res = await fetch(`${BASE_PATH}/api/account/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current, password }),
    }).catch(() => null)
    setLoading(false)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      setError(data?.error ?? "Passwort konnte nicht geändert werden")
      return
    }
    setSaved(true)
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Passwort ändern</DialogTitle>
      {saved ? (
        <div className="space-y-4">
          <p className="text-sm text-[#c5bfbf]">Dein Passwort ist geändert. Es gilt ab der nächsten Anmeldung.</p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Schließen</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">Aktuelles Passwort</Label>
            <Input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">Neues Passwort</Label>
            <Input id="pw-new" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
            <p className="text-xs text-[#5e5858]">Mindestens 8 Zeichen.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-repeat">Neues Passwort wiederholen</Label>
            <Input id="pw-repeat" type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" required />
          </div>
          {error && <p className="text-sm text-[#ED1F24]">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" type="button" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={loading}>{loading ? "Speichert…" : "Passwort ändern"}</Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
