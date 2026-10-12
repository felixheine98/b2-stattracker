"use client"

import { BASE_PATH } from "@/lib/base-path"
import { cn } from "@/lib/utils"
import { ChevronDown, KeyRound, LogOut, Moon, Search, Smartphone, Sun } from "lucide-react"
import { openSearch } from "@/components/search/search-dialog"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { ChangePasswordDialog } from "./change-password-dialog"
import { TwoFactorDialog } from "./two-factor-dialog"
import { toggleTheme } from "./theme-toggle"
import { accountsItem, canSeeAccounts, isActiveItem, navItems, profileItem } from "./nav-items"

interface Props {
  userName: string
  role: string
  // Address of the signed-in player's own profile; null for an account without a player
  profileHref: string | null
}

// Phones only: the app name and the user menu at the top of the screen
export function MobileTopBar({ userName, role, profileHref }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showTwoFactor, setShowTwoFactor] = useState(false)

  return (
    <header className="relative z-20 flex items-center gap-2.5 border-b border-line bg-surface px-4 py-2 md:hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${BASE_PATH}/b2-logo.svg?v=lion-20261011`} alt="" className="h-8 w-8 object-contain" />
      <span className="flex-1 text-base font-bold tracking-tight text-fg">B2 Stats</span>
      <button
        type="button"
        onClick={openSearch}
        aria-label="Search"
        className="rounded-md p-2 text-fg-soft hover:bg-raised"
      >
        <Search size={18} />
      </button>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex max-w-[40%] items-center gap-1 rounded-md px-2 py-1.5 text-sm text-fg-soft hover:bg-raised"
      >
        <span className="truncate">{userName}</span>
        <ChevronDown size={14} className="shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          <div className="absolute right-3 top-full z-10 mt-1 w-56 rounded-lg border border-line-strong bg-surface p-1 shadow-xl">
            <div className="px-3 py-2">
              <div className="truncate text-sm font-medium text-fg">{userName}</div>
              <div className="text-xs capitalize text-fg-subtle">{role.toLowerCase()}</div>
            </div>
            {profileHref && (
              <Link
                href={profileHref}
                onClick={() => setOpen(false)}
                aria-current={pathname === profileHref ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-raised",
                  pathname === profileHref ? "text-brand-ink" : "text-fg-soft"
                )}
              >
                <profileItem.icon size={16} />
                {profileItem.label}
              </Link>
            )}
            <button
              type="button"
              onClick={() => { setOpen(false); setShowPassword(true) }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-fg-soft hover:bg-raised"
            >
              <KeyRound size={16} />
              Change password
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setShowTwoFactor(true) }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-fg-soft hover:bg-raised"
            >
              <Smartphone size={16} />
              Sign-in security
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-fg-soft hover:bg-raised"
            >
              <Sun size={16} className="light:hidden" />
              <Moon size={16} className="hidden light:block" />
              <span className="light:hidden">Light theme</span>
              <span className="hidden light:inline">Dark theme</span>
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: `${BASE_PATH}/login` })}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-fg-soft hover:bg-raised hover:text-danger"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </>
      )}
      {showPassword && <ChangePasswordDialog onClose={() => setShowPassword(false)} />}
      {showTwoFactor && <TwoFactorDialog onClose={() => setShowTwoFactor(false)} />}
    </header>
  )
}

// Phones only: the pages of the app as a bar at the bottom of the screen
export function MobileTabBar({ role, profileHref }: Pick<Props, "role" | "profileHref">) {
  const pathname = usePathname()
  const items = canSeeAccounts(role) ? [...navItems, accountsItem] : navItems

  return (
    <nav className="flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActiveItem(pathname, href, profileHref)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[10px] font-medium transition-colors",
              active ? "text-brand-ink" : "text-fg-muted"
            )}
          >
            <Icon size={20} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
