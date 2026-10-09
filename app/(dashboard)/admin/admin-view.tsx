"use client"

import { BASE_PATH } from "@/lib/base-path"
import { useSyncedState } from "@/lib/use-synced-state"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { ChevronDown, Plus, Shield, ShieldCheck, Trash2, User } from "lucide-react"
import { useState } from "react"

type Role = "ADMIN" | "MANAGER" | "PLAYER"

interface UserRow {
  id: string
  name: string
  username: string
  email: string | null
  role: Role
  createdAt: Date
  player: { id: string; name: string } | null
}

const ROLE_BADGE: Record<Role, "red" | "primary" | "secondary"> = {
  ADMIN: "red",
  MANAGER: "primary",
  PLAYER: "secondary",
}

const ROLE_ORDER: Record<Role, number> = {
  ADMIN: 0,
  MANAGER: 1,
  PLAYER: 2,
}

const ROLE_ICON: Record<Role, typeof ShieldCheck> = {
  ADMIN: ShieldCheck,
  MANAGER: Shield,
  PLAYER: User,
}

interface Props {
  users: UserRow[]
  currentUserId: string
  // Managers see every account but can only create and delete PLAYER accounts
  isAdmin: boolean
}

export function AdminView({ users: initial, currentUserId, isAdmin }: Props) {
  const [users, setUsers] = useSyncedState(initial)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)

  const sortedUsers = [...users].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  )

  async function handleChangeRole(userId: string, role: Role) {
    setUpdatingRole(userId)
    const res = await fetch(`${BASE_PATH}/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    setUpdatingRole(null)
    if (!res.ok) return
    const updated = await res.json()
    setUsers((u) => u.map((user) => (user.id === userId ? { ...user, role: updated.role } : user)))
  }

  async function handleDelete(userId: string) {
    if (!confirm("Delete this user? This cannot be undone.")) return
    setDeleting(userId)
    const res = await fetch(`${BASE_PATH}/api/admin/users/${userId}`, { method: "DELETE" })
    setDeleting(null)
    if (res.ok) setUsers((u) => u.filter((user) => user.id !== userId))
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const res = await fetch(`${BASE_PATH}/api/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        username: form.get("username"),
        email: form.get("email"),
        password: form.get("password"),
        role: form.get("role") ?? "PLAYER",
      }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Failed to create user")
      return
    }
    const data = await res.json()
    setUsers((u) => [...u, data])
    setShowForm(false)
    ;(e.target as HTMLFormElement).reset()
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f5f0f0]">Accounts</h1>
          <p className="text-[#9a9090] text-sm mt-0.5">{users.length} accounts</p>
        </div>
        <Button onClick={() => { setShowForm(true); setError("") }}>
          <Plus size={16} />
          Add User
        </Button>
      </div>

      <div className="rounded-xl border border-[#2d2829] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2d2829] bg-[#251f20]">
              <th className="text-left px-4 py-3 text-[#9a9090] font-medium">User</th>
              <th className="text-left px-4 py-3 text-[#9a9090] font-medium">Username</th>
              <th className="text-left px-4 py-3 text-[#9a9090] font-medium">Player profile</th>
              <th className="text-left px-4 py-3 text-[#9a9090] font-medium">Role</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user) => {
              const RoleIcon = ROLE_ICON[user.role]
              const isSelf = user.id === currentUserId
              return (
                <tr key={user.id} className="border-b border-[#2d2829] last:border-0 hover:bg-[#251f20]/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#f5f0f0]">{user.name}</div>
                    {user.email && <div className="text-xs text-[#5e5858]">{user.email}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[#9a9090]">{user.username}</td>
                  <td className="px-4 py-3 text-[#9a9090]">
                    {user.player ? (
                      <span className="text-[#f5f0f0]">{user.player.name}</span>
                    ) : (
                      <span className="text-[#3a3435]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isSelf || !isAdmin ? (
                      <Badge variant={ROLE_BADGE[user.role]}>
                        <RoleIcon size={10} className="mr-1" />
                        {user.role}
                      </Badge>
                    ) : (
                      <Badge
                        variant={ROLE_BADGE[user.role]}
                        className={cn(
                          "relative focus-within:ring-2 focus-within:ring-[#FBD00D]",
                          updatingRole === user.id && "opacity-50"
                        )}
                      >
                        <RoleIcon size={10} className="mr-1" />
                        {user.role}
                        <ChevronDown size={10} className="ml-1" />
                        <select
                          value={user.role}
                          onChange={(e) => handleChangeRole(user.id, e.target.value as Role)}
                          disabled={updatingRole === user.id}
                          aria-label="Role"
                          className="absolute inset-0 w-full cursor-pointer appearance-none rounded-full opacity-0 disabled:cursor-not-allowed"
                        >
                          <option value="PLAYER">PLAYER</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isSelf && (isAdmin || user.role === "PLAYER") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(user.id)}
                        disabled={deleting === user.id}
                        className="text-[#5e5858] hover:text-[#ED1F24]"
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={showForm} onClose={() => setShowForm(false)}>
        <DialogTitle>Add User</DialogTitle>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" pattern="[a-zA-Z0-9_.\-]+" minLength={3} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email <span className="text-[#5e5858]">(optional)</span></Label>
            <Input id="email" name="email" type="email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {isAdmin && (
              <div className="space-y-1.5">
                <Label htmlFor="role">Role</Label>
                <Select id="role" name="role" defaultValue="PLAYER">
                  <option value="PLAYER">PLAYER</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="ADMIN">ADMIN</option>
                </Select>
              </div>
            )}
          </div>
          {error && <p className="text-sm text-[#ED1F24]">{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create User"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
