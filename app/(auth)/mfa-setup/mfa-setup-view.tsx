"use client"

import { TotpSetup } from "@/components/account/totp-setup"
import { BASE_PATH } from "@/lib/base-path"
import { signOut } from "next-auth/react"

export function MfaSetupView() {
  return (
    <div className="rounded-xl border border-[#2d2829] bg-[#1c1819] p-6">
      <h2 className="text-lg font-semibold text-[#f5f0f0] mb-2">Set up two-factor sign-in</h2>
      <p className="mb-4 text-sm text-[#9a9090]">Your account has to use it before you can go on.</p>
      {/* A full page load: the router still remembers that every page led back here */}
      <TotpSetup onDone={() => window.location.assign(`${BASE_PATH}/dashboard`)} />
      <p className="mt-4 text-center text-sm text-[#5e5858]">
        <button type="button" onClick={() => signOut({ callbackUrl: `${BASE_PATH}/login` })} className="hover:text-[#f5f0f0]">
          Sign out
        </button>
      </p>
    </div>
  )
}
