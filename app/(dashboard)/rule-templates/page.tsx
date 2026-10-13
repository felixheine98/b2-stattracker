import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { canManage } from "@/lib/roles"
import { toTemplate } from "@/lib/rule-templates"
import { redirect } from "next/navigation"
import { RuleTemplatesView } from "./rule-templates-view"

export default async function RuleTemplatesPage() {
  const session = await auth()
  if (!canManage((session?.user as { role?: string } | undefined)?.role)) redirect("/tournaments")
  const rows = await db.ruleTemplate.findMany()
  const templates = rows.map(toTemplate).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }))
  return <RuleTemplatesView templates={templates} />
}
