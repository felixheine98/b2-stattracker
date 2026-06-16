import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatLabel } from "@/lib/utils"
import Link from "next/link"
import { Trophy, Users, Swords, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default async function DashboardPage() {
  const session = await auth()

  const [playerCount, tournamentCount, matchCount, recentTournaments] = await Promise.all([
    db.player.count(),
    db.tournament.count(),
    db.match.count(),
    db.tournament.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { matches: true } } },
    }),
  ])

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">
          Welcome back, {session?.user?.name}
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">Here's an overview of your team's activity.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Players</CardTitle>
              <Users size={18} className="text-cyan-400" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-100">{playerCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">registered team members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Tournaments</CardTitle>
              <Trophy size={18} className="text-cyan-400" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-100">{tournamentCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">across all formats</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Matches</CardTitle>
              <Swords size={18} className="text-cyan-400" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-100">{matchCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">total matches played</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Recent Tournaments
        </h2>
        {recentTournaments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-slate-500 text-sm">No tournaments yet.</p>
              <Link href="/tournaments" className="text-cyan-400 text-sm hover:underline mt-1 inline-block">
                Create your first tournament →
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentTournaments.map((t) => (
              <Link key={t.id} href={`/tournaments/${t.id}`}>
                <Card className="hover:border-slate-600 transition-colors cursor-pointer">
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Trophy size={16} className="text-cyan-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-100">{t.name}</p>
                        <p className="text-xs text-slate-500">{t._count.matches} matches</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={t.format.startsWith("TIME") ? "cyan" : "purple"}>
                        {formatLabel(t.format)}
                      </Badge>
                      {t.startDate && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Calendar size={12} />
                          {new Date(t.startDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
