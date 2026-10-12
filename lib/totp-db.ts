import { db } from "./db"
import { afterWrongCode, decryptSecret, encryptSecret, hashRecoveryCode, isTotpCode, matchTotp } from "./totp"

// The stored secrets are encrypted with a key derived from the session secret
function key(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is not set")
  return secret
}

export function sealSecret(secret: string): string {
  return encryptSecret(secret, key())
}

export function openSecret(stored: string): string | null {
  return decryptSecret(stored, key())
}

export type SecondFactorResult = "ok" | "invalid" | "locked"

// The second step of a sign-in: a code from the app or one of the recovery codes. Wrong codes
// are counted and lock the step for a while; a recovery code is used up.
export async function checkSecondFactor(userId: string, input: string, now = new Date()): Promise<SecondFactorResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabledAt: true, totpLastStep: true, totpRecoveryCodes: true, totpFailures: true, totpLockedUntil: true },
  })
  if (!user?.totpSecret || !user.totpEnabledAt) return "invalid"
  if (user.totpLockedUntil && user.totpLockedUntil > now) return "locked"

  if (isTotpCode(input)) {
    const secret = openSecret(user.totpSecret)
    const step = secret ? matchTotp(secret, input, now.getTime(), user.totpLastStep) : null
    if (step != null) {
      await db.user.update({ where: { id: userId }, data: { totpLastStep: step, totpFailures: 0, totpLockedUntil: null } })
      return "ok"
    }
  } else {
    const hash = hashRecoveryCode(input)
    if (user.totpRecoveryCodes.includes(hash)) {
      await db.user.update({
        where: { id: userId },
        data: { totpRecoveryCodes: user.totpRecoveryCodes.filter((h) => h !== hash), totpFailures: 0, totpLockedUntil: null },
      })
      return "ok"
    }
  }

  // Counted in the database, so attempts sent at the same moment cannot slip past the count
  const counted = await db.user.update({ where: { id: userId }, data: { totpFailures: { increment: 1 } }, select: { totpFailures: true } })
  const { failures, lockedUntil } = afterWrongCode(counted.totpFailures - 1, now)
  if (lockedUntil) await db.user.update({ where: { id: userId }, data: { totpFailures: failures, totpLockedUntil: lockedUntil } })
  return "invalid"
}

// Switches two-factor sign-in off for an account and forgets everything that belonged to it
export async function clearTotp(userId: string) {
  await db.user.update({
    where: { id: userId },
    data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null, totpRecoveryCodes: [], totpFailures: 0, totpLockedUntil: null },
  })
}
