"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, Trophy, LogOut, ShieldCheck } from "lucide-react"
import { signOut } from "next-auth/react"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/players", label: "Players", icon: Users },
  { href: "/tournaments", label: "Tournaments", icon: Trophy },
]

interface SidebarProps {
  userName: string
  role: string
}

export function Sidebar({ userName, role }: SidebarProps) {
  const pathname = usePathname()
  const isAdmin = role === "ADMIN"

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-[#2d2829] bg-[#1c1819]">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[#2d2829]">
        <div className="h-7 w-7 rounded-md bg-[#FBD00D] flex items-center justify-center text-[#1a1718] font-bold text-sm">
          TM
        </div>
        <span className="font-semibold text-[#f5f0f0] text-sm tracking-tight">StatTracker</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-4">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-[#FBD00D]/10 text-[#FBD00D]"
                : "text-[#9a9090] hover:bg-[#251f20] hover:text-[#f5f0f0]"
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}

        {isAdmin && (
          <>
            <div className="mx-3 my-2 border-t border-[#2d2829]" />
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/admin"
                  ? "bg-[#ED1F24]/10 text-[#ED1F24]"
                  : "text-[#9a9090] hover:bg-[#251f20] hover:text-[#f5f0f0]"
              )}
            >
              <ShieldCheck size={16} />
              Admin
            </Link>
          </>
        )}
      </nav>

      <div className="border-t border-[#2d2829] px-3 py-4">
        <div className="mb-0.5 px-2 text-xs text-[#c5bfbf] truncate font-medium">{userName}</div>
        <div className="mb-2 px-2 text-xs text-[#5e5858] capitalize">{role.toLowerCase()}</div>
        <button
          onClick={() => signOut({ callbackUrl: "/b2-stats/login" })}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[#9a9090] hover:bg-[#251f20] hover:text-[#ED1F24] transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
