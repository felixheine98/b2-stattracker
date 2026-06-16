export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500 text-slate-900 font-bold text-lg">
            TM
          </div>
          <h1 className="text-2xl font-bold text-slate-100">StatTracker</h1>
          <p className="text-slate-400 text-sm mt-1">Trackmania Team Stats</p>
        </div>
        {children}
      </div>
    </div>
  )
}
