"use client"

import { SessionProvider } from "next-auth/react"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/b2-stats/api/auth">
      {children}
    </SessionProvider>
  )
}
