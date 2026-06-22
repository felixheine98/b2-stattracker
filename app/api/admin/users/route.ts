import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"

function isAdmin(role?: string | null) {
  return role === "ADMIN"
}

export async function GET() {
  const session = await auth()
  if (!isAdmin((session?.user as { role?: string })?.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
      player: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(users)
}

const createSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(3).regex(/^[a-zA-Z0-9_.\-]+$/),
  email: z.string().email().optional().or(z.literal("")).transform(v => v || null),
  password: z.string().min(1),
  role: z.enum(["ADMIN", "MANAGER", "PLAYER"]).default("PLAYER"),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!isAdmin((session?.user as { role?: string })?.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const { name, username, email, password, role } = parsed.data

  const [byEmail, byUsername] = await Promise.all([
    email ? db.user.findUnique({ where: { email } }) : null,
    db.user.findUnique({ where: { username } }),
  ])
  if (byEmail) return NextResponse.json({ error: "Email already in use" }, { status: 409 })
  if (byUsername) return NextResponse.json({ error: "Username already taken" }, { status: 409 })

  const hashed = await bcrypt.hash(password, 12)
  const user = await db.user.create({
    data: { name, username, email, password: hashed, role },
    select: { id: true, name: true, username: true, email: true, role: true, createdAt: true, player: { select: { id: true, name: true } } },
  })

  return NextResponse.json(user, { status: 201 })
}
