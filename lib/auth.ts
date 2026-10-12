import { BASE_PATH } from "@/lib/base-path"
import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "./db"
import { needsMfaSetup, passwordNeedsPasskey } from "./mfa"
import { verifyPasskeyLogin } from "./passkey-db"
import { checkSecondFactor } from "./totp-db"
import bcrypt from "bcryptjs"
import { z } from "zod"

const credentialsSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  // The second step, for accounts with two-factor sign-in: a code from the app or a recovery code
  code: z.string().max(20).optional(),
})

// A sign-in with a passkey instead: what the browser answered to the challenge, as JSON
const passkeySchema = z.object({ passkey: z.string().min(1).max(10_000) })

// Reasons the login page can tell apart (they arrive there as `code`). All of them only
// occur after the password was correct.
class TotpRequired extends CredentialsSignin {
  code = "totp_required"
}
class TotpInvalid extends CredentialsSignin {
  code = "totp_invalid"
}
class TotpLocked extends CredentialsSignin {
  code = "totp_locked"
}
class PasskeyRequired extends CredentialsSignin {
  code = "passkey_required"
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        login: {},
        password: {},
        code: {},
        passkey: {},
      },
      async authorize(credentials) {
        // A passkey signs in on its own: no password and no code
        const withPasskey = passkeySchema.safeParse(credentials)
        if (withPasskey.success) {
          const response = await Promise.resolve(withPasskey.data.passkey).then(JSON.parse).catch(() => null)
          const user = response && (await verifyPasskeyLogin(response))
          if (!user) return null
          return { id: user.id, email: user.email, name: user.name, role: user.role }
        }

        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { login, password, code } = parsed.data

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

        const passkeys = await db.passkey.count({ where: { userId: user.id } })
        if (passwordNeedsPasskey({ role: user.role, totp: !!user.totpEnabledAt, passkeys })) throw new PasskeyRequired()

        if (user.totpEnabledAt) {
          if (!code) throw new TotpRequired()
          const result = await checkSecondFactor(user.id, code)
          if (result === "locked") throw new TotpLocked()
          if (result !== "ok") throw new TotpInvalid()
        }

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role
      }
      // Re-read the account on every use: a deleted login is signed out at once
      // and a changed role applies without waiting for the token to expire
      if (token.id) {
        const current = await db.user.findUnique({ where: { id: token.id as string }, select: { role: true, totpEnabledAt: true, _count: { select: { passkeys: true } } } })
        if (!current) return null
        token.role = current.role
        // An account that has to use a second factor but has not set one up yet only gets to the setup (proxy.ts)
        token.mfaSetupRequired = needsMfaSetup({ role: current.role, totp: !!current.totpEnabledAt, passkeys: current._count.passkeys })
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      ;(session.user as { role?: string }).role = token.role as string
      session.user.mfaSetupRequired = token.mfaSetupRequired === true
      return session
    },
  },
  pages: {
    signIn: `${BASE_PATH}/login`,
  },
})
