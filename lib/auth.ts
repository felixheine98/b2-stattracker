import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "./db"
import bcrypt from "bcryptjs"
import { z } from "zod"

const credentialsSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        login: {},
        password: {},
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { login, password } = parsed.data

        // Always try username first
        let user = await db.user.findUnique({ where: { username: login } })

        // Fall back to email lookup (ADMIN only, and only if login looks like an email)
        if (!user && login.includes("@")) {
          const byEmail = await db.user.findUnique({ where: { email: login } })
          if (byEmail?.role === "ADMIN") user = byEmail
        }

        if (!user) return null

        const valid = await bcrypt.compare(password, user.password)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role
        return token
      }
      // Re-read the account on every use: a deleted login is signed out at once
      // and a changed role applies without waiting for the token to expire
      if (token.id) {
        const current = await db.user.findUnique({ where: { id: token.id as string }, select: { role: true } })
        if (!current) return null
        token.role = current.role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      ;(session.user as { role?: string }).role = token.role as string
      return session
    },
  },
  pages: {
    signIn: "/b2-stats/login",
  },
})
