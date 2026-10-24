import Link from "next/link"
import { BrandLogo } from "@/components/brand-logo"
import { vodArchiveEnabled } from "@/lib/features"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell bg-canvas">
      <div className="page-narrow mx-auto w-full sm:w-104">
        <div className="auth-brand">
          <div className="mb-5 flex items-center gap-3">
            <BrandLogo className="h-12 w-10 object-contain" />
            <span className="text-lg font-semibold">B2 Stats</span>
          </div>
          <h1>Back with the team.</h1>
          <p className="mt-2 text-sm">Trackmania results, lineups and team stats.</p>
        </div>
        <div className="auth-form">
          {children}
          {/* Google asks the app's home page to link its privacy policy (docs/adr/011) */}
          {vodArchiveEnabled() && (
            <p className="mt-3 text-center text-xs">
              <Link href="/privacy" className="text-fg-subtle hover:text-fg">Privacy policy</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
