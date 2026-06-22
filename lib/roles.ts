export function canManage(role?: string | null): boolean {
  return role === "ADMIN" || role === "MANAGER"
}
