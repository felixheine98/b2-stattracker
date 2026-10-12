"use client"

import { PasskeyAdd } from "@/components/account/passkey-add"
import { TotpSetup } from "@/components/account/totp-setup"
import { Button } from "@/components/ui/button"
import { BASE_PATH } from "@/lib/base-path"
import { signOut } from "next-auth/react"
import { useState } from "react"

export function MfaSetupView() {
  const [method, setMethod] = useState<"totp" | "passkey" | null>(null)

  // A full page load: the router still remembers that every page led back here
  const done = () => window.location.assign(`${BASE_PATH}/dashboard`)

  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold text-fg mb-2">Secure your sign-in</h2>
      <p className="mb-4 text-sm text-fg-muted">Your account needs a second factor before you can go on.</p>
      {/* In this card the buttons share the full width, like the one of the login (in dialogs they sit on the right) */}
      <div className="[&_.dialog-footer>*]:flex-1">
        {method === "totp" ? (
          <TotpSetup onDone={done} onCancel={() => setMethod(null)} />
        ) : method === "passkey" ? (
          <PasskeyAdd onDone={done} onCancel={() => setMethod(null)} />
        ) : (
          <div className="space-y-3">
            <Button className="w-full" onClick={() => setMethod("passkey")}>Passkey</Button>
            <p className="text-xs text-fg-subtle">Sign in with your fingerprint, face or PIN – without password.</p>
            <Button variant="outline" className="w-full" onClick={() => setMethod("totp")}>Authenticator app</Button>
            <p className="text-xs text-fg-subtle">Sign in with your password and a code from an app on your phone.</p>
          </div>
        )}
      </div>
      <p className="mt-4 text-center text-sm text-fg-subtle">
        <button type="button" onClick={() => signOut({ callbackUrl: `${BASE_PATH}/login` })} className="hover:text-fg">
          Sign out
        </button>
      </p>
    </div>
  )
}
