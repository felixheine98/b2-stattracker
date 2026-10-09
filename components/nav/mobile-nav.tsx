"use client"

import { BASE_PATH } from "@/lib/base-path"
import { cn } from "@/lib/utils"
import { ChevronDown, KeyRound, LogOut } from "lucide-react"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { ChangePasswordDialog } from "./change-password-dialog"
import { accountsItem, canSeeAccounts, navItems } from "./nav-items"

interface Props {
  userName: string
  role: string
}

// Phones only: the app name and the user menu at the top of the screen
export function MobileTopBar({ userName, role }: Props) {
  const [open, setOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <header className="relative z-20 flex items-center gap-2.5 border-b border-[#2d2829] bg-[#1c1819] px-4 py-2 md:hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${BASE_PATH}/b2-logo.svg`} alt="" className="h-8 w-8 object-contain" />
      <span className="flex-1 text-base font-bold tracking-tight text-[#f5f0f0]">B2 Stats</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex max-w-[50%] items-center gap-1 rounded-md px-2 py-1.5 text-sm text-[#c5bfbf] hover:bg-[#251f20]"
      >
        <span className="truncate">{userName}</span>
        <ChevronDown size={14} className="shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          <div className="absolute right-3 top-full z-10 mt-1 w-56 rounded-lg border border-[#3a3435] bg-[#1c1819] p-1 shadow-xl">
            <div className="px-3 py-2">
              <div className="truncate text-sm font-medium text-[#f5f0f0]">{userName}</div>
              <div className="text-xs capitalize text-[#5e5858]">{role.toLowerCase()}</div>
            </div>
            <button
              type="button"
              onClick={() => { setOpen(false); setShowPassword(true) }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-[#c5bfbf] hover:bg-[#251f20]"
            >
              <KeyRound size={16} />
              Passwort ändern
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: `${BASE_PATH}/login` })}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-[#c5bfbf] hover:bg-[#251f20] hover:text-[#ED1F24]"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </>
      )}
      {showPassword && <ChangePasswordDialog onClose={() => setShowPassword(false)} />}
    </header>
  )
}

// Phones only: the pages of the app as a bar at the bottom of the screen
export function MobileTabBar({ role }: { role: string }) {
  const pathname = usePathname()
  const items = canSeeAccounts(role) ? [...navItems, accountsItem] : navItems

  return (
    <nav className="flex border-t border-[#2d2829] bg-[#1c1819] pb-[env(safe-area-inset-bottom)] md:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/")
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[10px] font-medium transition-colors",
              active ? "text-[#FBD00D]" : "text-[#9a9090]"
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
