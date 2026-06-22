export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e0b0b] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#FBD00D] text-[#1a1718] font-bold text-lg">
            TM
          </div>
          <h1 className="text-2xl font-bold text-[#f5f0f0]">StatTracker</h1>
          <p className="text-[#9a9090] text-sm mt-1">Trackmania Team Stats</p>
        </div>
        {children}
      </div>
    </div>
  )
}
