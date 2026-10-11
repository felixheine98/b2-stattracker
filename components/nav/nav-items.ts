import { CircleUser, LayoutDashboard, ShieldCheck, Trophy, Users, Swords } from "lucide-react"

// The pages of the app, shown in the sidebar and in the bottom bar on phones
export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/players", label: "Players", icon: Users },
  { href: "/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/opponents", label: "Opponents", icon: Swords },
]

// The signed-in player's own profile: its own entry, although the page lies below "Players"
export const profileItem = { label: "My profile", icon: CircleUser }

// Whether a page of the navigation is the one being shown. The own profile counts for
// "Mein Profil" only, every other profile for "Players".
export function isActiveItem(pathname: string, href: string, profileHref: string | null): boolean {
  if (profileHref && pathname === profileHref) return href === profileHref
  return pathname === href || pathname.startsWith(href + "/")
}

// Only for admins and managers
export const accountsItem = { href: "/admin", label: "Accounts", icon: ShieldCheck }

export const canSeeAccounts = (role: string) => role === "ADMIN" || role === "MANAGER"
