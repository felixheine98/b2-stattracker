"use client"

import { BASE_PATH } from "@/lib/base-path"
import { SessionProvider } from "next-auth/react"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath={`${BASE_PATH}/api/auth`}>
      {children}
    </SessionProvider>
  )
}
