"use client"

import { BrandLogo } from "@/components/brand-logo"
import { BASE_PATH } from "@/lib/base-path"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { ChevronDown, KeyRound, LogOut, Moon, Search, ShieldCheck, Smartphone, Sun, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { openSearch } from "@/components/search/search-dialog"
import { isActiveItem, navItems, profileItem } from "./nav-items"
import { useState, useSyncExternalStore } from "react"
import { ChangePasswordDialog } from "./change-password-dialog"
import { TwoFactorDialog } from "./two-factor-dialog"
import { toggleTheme } from "./theme-toggle"
import { signOut } from "next-auth/react"
import { parseStyle, styleLabel, styleParam } from "@/lib/comp-styles"
import type { CompStyle } from "@prisma/client"

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
  // Address of the signed-in player's own profile; null for an account without a player
  profileHref: string | null
  // The styles that have tournaments, listed below "Tournaments" to narrow the list
  styles: CompStyle[]
}

export function Sidebar({ userName, role, profileHref, styles }: SidebarProps) {
  const pathname = usePathname()
  const shownStyle = parseStyle(useSearchParams().get("style") ?? undefined)
  // The styles are open while a tournament page is shown, unless opened or closed by hand
  const [stylesOpen, setStylesOpen] = useState<boolean | null>(null)
  const showStyles = stylesOpen ?? pathname.startsWith("/tournaments")
  const canSeeAccounts = role === "ADMIN" || role === "MANAGER"
  const collapsed = useSyncExternalStore(subscribeCollapsed, () => localStorage.getItem(COLLAPSED_KEY) === "1", () => false)

  const [showPassword, setShowPassword] = useState(false)
  const [showTwoFactor, setShowTwoFactor] = useState(false)

  function toggleCollapsed() {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "0" : "1")
    window.dispatchEvent(new Event(COLLAPSED_EVENT))
  }

  return (
    <aside className={cn("relative hidden h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width]", collapsed ? "w-14" : "w-56",
      // Phones use the bottom bar instead (components/nav/mobile-nav.tsx)
      "md:flex")}>
      {/* Sits just outside the sidebar, in the top left corner of the page (the layout leaves room for it) */}
      <button
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute left-full top-[18px] z-10 ml-3 flex h-8 w-8 items-center justify-center rounded-md text-fg-subtle hover:bg-raised hover:text-fg transition-colors"
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>
      <div className={cn("flex items-center gap-3 py-4 border-b border-line", collapsed ? "justify-center px-2" : "px-5")}>
        <BrandLogo className={cn("object-contain", collapsed ? "h-9 w-9" : "h-11 w-11")} />
        {!collapsed && <span className="font-bold text-fg text-xl tracking-tight">B2 Stats</span>}
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-4">
        <button
          type="button"
          onClick={openSearch}
          title={collapsed ? "Search (Ctrl+K)" : undefined}
          aria-label="Search"
          className={cn(
            "mb-3 flex w-full items-center gap-3 rounded-md border border-line bg-raised/60 py-2 text-sm text-fg-subtle transition-colors hover:border-line-strong hover:text-fg",
            collapsed ? "justify-center px-0" : "px-3"
          )}
        >
          <Search size={16} className="shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search</span>
              <kbd className="text-[10px] text-fg-subtle">Ctrl K</kbd>
            </>
          )}
        </button>
        {[...navItems, ...(profileHref ? [{ href: profileHref, ...profileItem }] : [])].map(({ href, label, icon: Icon }) => {
          const hasStyles = href === "/tournaments" && !collapsed && styles.length > 0
          return (
            <div key={href}>
              <div className="relative">
                <Link
                  href={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors",
                    collapsed ? "justify-center px-0" : "px-3",
                    hasStyles && "pr-9",
                    isActiveItem(pathname, href, profileHref)
                      ? "bg-brand/10 text-brand-ink"
                      : "text-fg-muted hover:bg-raised hover:text-fg"
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  {!collapsed && label}
                </Link>
                {hasStyles && (
                  <button
                    type="button"
                    onClick={() => setStylesOpen(!showStyles)}
                    aria-expanded={showStyles}
                    aria-label={showStyles ? "Hide styles" : "Show styles"}
                    className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted hover:bg-raised hover:text-fg"
                  >
                    <ChevronDown size={14} className={cn("transition-transform", showStyles && "rotate-180")} />
                  </button>
                )}
              </div>
              {hasStyles && showStyles && (
                <div className="ml-5 mt-0.5 space-y-0.5 border-l border-line pl-2">
                  {[null, ...styles].map((style) => {
                    const active = pathname === "/tournaments" && style === shownStyle
                    return (
                      <Link
                        key={style ?? "all"}
                        href={style ? `/tournaments?style=${styleParam(style)}` : "/tournaments"}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "block rounded-md px-3 py-1.5 text-sm transition-colors",
                          active ? "font-medium text-brand-ink" : "text-fg-muted hover:bg-raised hover:text-fg"
                        )}
                      >
                        {style ? styleLabel(style) : "All"}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {canSeeAccounts && (
          <>
            <div className={cn("my-2 border-t border-line", collapsed ? "mx-1" : "mx-3")} />
            <Link
              href="/admin"
              title={collapsed ? "Accounts" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0" : "px-3",
                pathname === "/admin"
                  ? "bg-danger/10 text-danger"
                  : "text-fg-muted hover:bg-raised hover:text-fg"
              )}
            >
              <ShieldCheck size={16} className="shrink-0" />
              {!collapsed && "Accounts"}
            </Link>
          </>
        )}
      </nav>

      <div className={cn("border-t border-line py-4", collapsed ? "px-2" : "px-3")}>
        {!collapsed && (
          <>
            <div className="mb-0.5 px-2 text-xs text-fg-soft truncate font-medium">{userName}</div>
            <div className="mb-2 px-2 text-xs text-fg-subtle capitalize">{role.toLowerCase()}</div>
          </>
        )}
        <button
          onClick={() => setShowPassword(true)}
          title={collapsed ? "Change password" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-md py-2 text-sm font-medium text-fg-muted hover:bg-raised hover:text-fg transition-colors",
            collapsed ? "justify-center px-0" : "px-3"
          )}
        >
          <KeyRound size={16} className="shrink-0" />
          {!collapsed && "Change password"}
        </button>
        <button
          onClick={() => setShowTwoFactor(true)}
          title={collapsed ? "Sign-in security" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-md py-2 text-sm font-medium text-fg-muted hover:bg-raised hover:text-fg transition-colors",
            collapsed ? "justify-center px-0" : "px-3"
          )}
        >
          <Smartphone size={16} className="shrink-0" />
          {!collapsed && "Sign-in security"}
        </button>
        <button
          onClick={toggleTheme}
          title={collapsed ? "Switch theme" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-md py-2 text-sm font-medium text-fg-muted hover:bg-raised hover:text-fg transition-colors",
            collapsed ? "justify-center px-0" : "px-3"
          )}
        >
          <Sun size={16} className="shrink-0 light:hidden" />
          <Moon size={16} className="hidden shrink-0 light:block" />
          {!collapsed && (
            <>
              <span className="light:hidden">Light theme</span>
              <span className="hidden light:inline">Dark theme</span>
            </>
          )}
        </button>
        <button
          onClick={() => signOut({ callbackUrl: `${BASE_PATH}/login` })}
          title={collapsed ? `Sign out (${userName})` : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-md py-2 text-sm font-medium text-fg-muted hover:bg-raised hover:text-danger transition-colors",
            collapsed ? "justify-center px-0" : "px-3"
          )}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && "Sign out"}
        </button>
      </div>
      {showPassword && <ChangePasswordDialog onClose={() => setShowPassword(false)} />}
      {showTwoFactor && <TwoFactorDialog onClose={() => setShowTwoFactor(false)} />}
    </aside>
  )
}
