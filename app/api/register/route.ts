import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1),
  username: z.string().min(3, "Username must be at least 3 characters").regex(/^[a-zA-Z0-9_.-]+$/, "Username may only contain letters, numbers, underscores, dots and hyphens"),
  email: z.string().email().optional().or(z.literal("")).transform(v => v || null),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, username, email, password } = parsed.data

  const checks = await Promise.all([
    email ? db.user.findUnique({ where: { email } }) : null,
    db.user.findUnique({ where: { username } }),
  ])

  if (checks[0]) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
  if (checks[1]) return NextResponse.json({ error: "This username is already taken" }, { status: 409 })

  const hashed = await bcrypt.hash(password, 12)
  const existingCount = await db.user.count()
  const user = await db.user.create({
    data: { name, username, email, password: hashed, role: existingCount === 0 ? "ADMIN" : "PLAYER" },
    select: { id: true, name: true, username: true, email: true, role: true },
  })

  return NextResponse.json(user, { status: 201 })
}
