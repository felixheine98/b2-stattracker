// The comps transcribed from stats screenshots, to compare (docs/adr/007). Dev only.
import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { summaryCompareEnabled } from "@/lib/features"
import { canManage } from "@/lib/roles"
import { summaryFiles } from "@/lib/summary-compare-db"
import { Badge } from "@/components/ui/badge"

export default async function SummaryComparePage() {
  const session = await auth()
  if (!summaryCompareEnabled() || !canManage((session?.user as { role?: string } | undefined)?.role)) redirect("/tournaments")
  const files = await summaryFiles()
  return (
    <div className="space-y-6 page-wide">
      <div>
        <h1 className="text-fg page-title">Screenshot comparison</h1>
        <p className="mt-1 text-sm text-fg-muted">Old stats screenshots next to the values taken over from them. Dev only.</p>
      </div>
      {files.length === 0 && <p className="text-sm text-fg-subtle">No comp transcribed yet.</p>}
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {files.map((f) => (
          <li key={f.file}>
            <Link href={`/summary-compare/${f.file}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-raised">
              <span className="font-medium text-fg">{f.comp || f.file}</span>
              <span className="text-xs text-fg-subtle">{f.file}.tsv</span>
              {f.errors > 0 && <Badge variant="red">{f.errors} errors</Badge>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
