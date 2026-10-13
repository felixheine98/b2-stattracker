import type { Metadata, Viewport } from "next"
import { cookies } from "next/headers"
import { THEME_COLOR, THEME_COOKIE, themeFromCookie } from "@/lib/theme"
import { Inter, Space_Grotesk } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { BASE_PATH } from "@/lib/base-path"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-heading" })

export const metadata: Metadata = {
  title: "B2 Stats – Trackmania Team Stats",
  description: "Track your Trackmania team's tournament performance",
  // Explicit icons let Dev use distinct artwork. The production assets keep their URLs.
  icons: {
    icon: process.env.NODE_ENV === "development"
      ? [
          { url: `${BASE_PATH}/favicon-dev.ico?v=orange-20261013`, sizes: "any" },
          { url: `${BASE_PATH}/icon-dev.svg?v=orange-20261013`, type: "image/svg+xml", sizes: "any" },
        ]
      : [
          { url: `${BASE_PATH}/favicon.ico`, sizes: "any" },
          { url: `${BASE_PATH}/icon.svg`, type: "image/svg+xml", sizes: "any" },
        ],
  },
}

// The theme someone chose in the account menu; dark without a choice
async function chosenTheme() {
  return themeFromCookie((await cookies()).get(THEME_COOKIE)?.value)
}

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: THEME_COLOR[await chosenTheme()] }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme={await chosenTheme()} className={`h-full ${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
