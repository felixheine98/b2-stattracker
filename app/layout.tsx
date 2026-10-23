import type { Metadata, Viewport } from "next"
import { cookies } from "next/headers"
import { resolveTheme, THEME_COLOR, THEME_COOKIE, themeFromCookie } from "@/lib/theme"
import { ThemeController } from "@/components/nav/theme-controller"
import { Barlow_Semi_Condensed, IBM_Plex_Sans } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { BASE_PATH } from "@/lib/base-path"

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" })
const barlow = Barlow_Semi_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-heading", display: "swap" })

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
  const choice = await chosenTheme()
  return {
    themeColor: choice === "system"
      ? [
          { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
          { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
        ]
      : THEME_COLOR[choice],
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const choice = await chosenTheme()
  return (
    <html lang="en" data-theme={resolveTheme(choice, true)} data-theme-choice={choice} suppressHydrationWarning className={`h-full ${plex.variable} ${barlow.variable}`}>
      <body className="min-h-full antialiased">
        {/* Resolve the device preference before first paint, as in Next's preventing-flash guide. */}
        <script dangerouslySetInnerHTML={{ __html: `if(document.documentElement.dataset.themeChoice==="system"){document.documentElement.dataset.theme=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}` }} />
        <ThemeController />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
