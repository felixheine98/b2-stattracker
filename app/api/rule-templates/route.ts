import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"
import { matchRulesEnabled } from "@/lib/features"
import { readTemplate, templateContentSchema, toTemplate } from "@/lib/rule-templates"

// Not there while the format rules are switched off
async function forbidden() {
  if (!matchRulesEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return null
}

export async function GET() {
  const denied = await forbidden()
  if (denied) return denied
  const rows = await db.ruleTemplate.findMany()
  return NextResponse.json(rows.map(toTemplate).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" })))
}

const createSchema = templateContentSchema.extend({
  name: z.string().trim().min(1, "Enter a name for the template").max(60),
  // Replace the template that already has this name
  overwrite: z.boolean().optional(),
})

export async function POST(req: Request) {
  const denied = await forbidden()
  if (denied) return denied
  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const read = readTemplate(parsed.data)
  if ("error" in read) return NextResponse.json({ error: read.error }, { status: 400 })

  const { name, overwrite } = parsed.data
  const existing = await db.ruleTemplate.findUnique({ where: { name } })
  if (existing && !overwrite) return NextResponse.json({ error: "There is already a template with this name" }, { status: 409 })
  const content = read.content as object
  const row = existing
    ? await db.ruleTemplate.update({ where: { id: existing.id }, data: { content } })
    : await db.ruleTemplate.create({ data: { name, content } })
  return NextResponse.json(toTemplate(row), { status: 201 })
}
