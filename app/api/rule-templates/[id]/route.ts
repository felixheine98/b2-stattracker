import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"
import { canManage } from "@/lib/roles"
import { readTemplate, templateContentSchema, toTemplate } from "@/lib/rule-templates"

interface Params {
  params: Promise<{ id: string }>
}

async function forbidden() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManage((session.user as { role?: string }).role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return null
}

// Whatever is left out stays as it is
const patchSchema = templateContentSchema.partial().extend({
  name: z.string().trim().min(1, "Enter a name for the template").max(60).optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const denied = await forbidden()
  if (denied) return denied
  const { id } = await params
  const parsed = patchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const row = await db.ruleTemplate.findUnique({ where: { id } })
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { name, ...changes } = parsed.data
  const current = toTemplate(row)
  const read = readTemplate({
    formats: changes.formats ?? (current.formats as z.infer<typeof templateContentSchema>["formats"]),
    rules: changes.rules ?? current.rules,
    playoffRules: changes.playoffRules !== undefined ? changes.playoffRules : (current.playoffRules as z.infer<typeof templateContentSchema>["playoffRules"]),
  })
  if ("error" in read) return NextResponse.json({ error: read.error }, { status: 400 })
  if (name && name !== row.name && (await db.ruleTemplate.findUnique({ where: { name } }))) {
    return NextResponse.json({ error: "There is already a template with this name" }, { status: 409 })
  }
  const saved = await db.ruleTemplate.update({ where: { id }, data: { ...(name && { name }), content: read.content as object } })
  return NextResponse.json(toTemplate(saved))
}

export async function DELETE(_req: Request, { params }: Params) {
  const denied = await forbidden()
  if (denied) return denied
  const { id } = await params
  await db.ruleTemplate.deleteMany({ where: { id } })
  return NextResponse.json({ ok: true })
}
