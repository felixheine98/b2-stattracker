"use client"

import { BASE_PATH } from "@/lib/base-path"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, Trophy, LogOut, ShieldCheck, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useSyncExternalStore } from "react"
import { signOut } from "next-auth/react"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/players", label: "Players", icon: Users },
  { href: "/tournaments", label: "Tournaments", icon: Trophy },
]

// Whether the sidebar is collapsed to its icons, remembered per browser
const COLLAPSED_KEY = "sidebar-collapsed"
const COLLAPSED_EVENT = "sidebar-collapsed-change"

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(COLLAPSED_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(COLLAPSED_EVENT, onChange)
  }
}

interface SidebarProps {
  userName: string
  role: string
}

export function Sidebar({ userName, role }: SidebarProps) {
  const pathname = usePathname()
  const canSeeAccounts = role === "ADMIN" || role === "MANAGER"
  const collapsed = useSyncExternalStore(subscribeCollapsed, () => localStorage.getItem(COLLAPSED_KEY) === "1", () => false)

  function toggleCollapsed() {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "0" : "1")
    window.dispatchEvent(new Event(COLLAPSED_EVENT))
  }

  return (
    <aside className={cn("relative flex h-screen shrink-0 flex-col border-r border-[#2d2829] bg-[#1c1819] transition-[width]", collapsed ? "w-14" : "w-56")}>
      {/* Sits just outside the sidebar, in the top left corner of the page (the layout leaves room for it) */}
      <button
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Seitenleiste ausklappen" : "Seitenleiste einklappen"}
        title={collapsed ? "Seitenleiste ausklappen" : "Seitenleiste einklappen"}
        className="absolute left-full top-[18px] z-10 ml-3 flex h-8 w-8 items-center justify-center rounded-md text-[#5e5858] hover:bg-[#251f20] hover:text-[#f5f0f0] transition-colors"
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>
      <div className={cn("flex items-center gap-3 py-4 border-b border-[#2d2829]", collapsed ? "justify-center px-2" : "px-5")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${BASE_PATH}/b2-logo.svg`} alt="" className={cn("object-contain", collapsed ? "h-9 w-9" : "h-11 w-11")} />
        {!collapsed && <span className="font-bold text-[#f5f0f0] text-xl tracking-tight">B2 Stats</span>}
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-4">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors",
              collapsed ? "justify-center px-0" : "px-3",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-[#FBD00D]/10 text-[#FBD00D]"
                : "text-[#9a9090] hover:bg-[#251f20] hover:text-[#f5f0f0]"
            )}
          >
            <Icon size={16} className="shrink-0" />
            {!collapsed && label}
          </Link>
        ))}

        {canSeeAccounts && (
          <>
            <div className={cn("my-2 border-t border-[#2d2829]", collapsed ? "mx-1" : "mx-3")} />
            <Link
              href="/admin"
              title={collapsed ? "Accounts" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0" : "px-3",
                pathname === "/admin"
                  ? "bg-[#ED1F24]/10 text-[#ED1F24]"
                  : "text-[#9a9090] hover:bg-[#251f20] hover:text-[#f5f0f0]"
              )}
            >
              <ShieldCheck size={16} className="shrink-0" />
              {!collapsed && "Accounts"}
            </Link>
          </>
        )}
      </nav>

      <div className={cn("border-t border-[#2d2829] py-4", collapsed ? "px-2" : "px-3")}>
        {!collapsed && (
          <>
            <div className="mb-0.5 px-2 text-xs text-[#c5bfbf] truncate font-medium">{userName}</div>
            <div className="mb-2 px-2 text-xs text-[#5e5858] capitalize">{role.toLowerCase()}</div>
          </>
        )}
        <button
          onClick={() => signOut({ callbackUrl: `${BASE_PATH}/login` })}
          title={collapsed ? `Sign out (${userName})` : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-md py-2 text-sm font-medium text-[#9a9090] hover:bg-[#251f20] hover:text-[#ED1F24] transition-colors",
            collapsed ? "justify-center px-0" : "px-3"
          )}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </aside>
  )
}
