import { BASE_PATH } from "@/lib/base-path"
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${BASE_PATH}/b2-logo.svg?v=lion-20261011`} alt="" className="mx-auto mb-3 h-16 w-16" />
          <h1 className="text-2xl font-bold text-fg">B2 Stats</h1>
          <p className="text-fg-muted text-sm mt-1">Trackmania Team Stats</p>
        </div>
        {children}
      </div>
    </div>
  )
}
