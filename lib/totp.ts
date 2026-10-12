import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual } from "node:crypto"

// Two-factor sign-in with codes from an authenticator app (TOTP, RFC 6238): six digits,
// a new code every 30 seconds, SHA-1 – the variant every authenticator app reads.

const STEP_MS = 30_000
const DIGITS = 6
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function base32Encode(bytes: Buffer): string {
  let bits = ""
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0")
  let out = ""
  for (let i = 0; i < bits.length; i += 5) out += BASE32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)]
  return out
}

function base32Decode(text: string): Buffer {
  let bits = ""
  for (const char of text.toUpperCase().replace(/[\s=]/g, "")) {
    const value = BASE32.indexOf(char)
    if (value < 0) throw new Error("Not a base32 secret")
    bits += value.toString(2).padStart(5, "0")
  }
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

// A new secret for an authenticator app: 160 bits, in base32
export function generateSecret(): string {
  return base32Encode(randomBytes(20))
}

function codeForStep(secret: string, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const number = hmac.readUInt32BE(offset) & 0x7fffffff
  return String(number % 10 ** DIGITS).padStart(DIGITS, "0")
}

// The code an authenticator app shows for the secret at the given time
export function totpCode(secret: string, timeMs: number): string {
  return codeForStep(secret, Math.floor(timeMs / STEP_MS))
}

function clean(input: string): string {
  return input.replace(/\s/g, "")
}

// Six digits are a code from the app; anything else typed in the code field is tried as a recovery code
export function isTotpCode(input: string): boolean {
  return /^\d{6}$/.test(clean(input))
}

// Checks a typed code. The steps before and after the current one count too, for clocks that
// are slightly off. Returns the time step of the code, or null if it does not fit. A step up to
// lastStep is refused, so a code that was used once cannot be used again.
export function matchTotp(secret: string, input: string, timeMs: number, lastStep?: number | null): number | null {
  if (!isTotpCode(input)) return null
  const code = Buffer.from(clean(input))
  const current = Math.floor(timeMs / STEP_MS)
  for (const step of [current, current - 1, current + 1]) {
    if (lastStep != null && step <= lastStep) continue
    if (timingSafeEqual(Buffer.from(codeForStep(secret, step)), code)) return step
  }
  return null
}

// What the QR code holds: the secret together with the names the app shows for it
export function otpauthUri(secret: string, account: string, issuer: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_MS / 1000}`
}

// Letters and digits that are hard to mix up when written down or typed in
const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"

// Codes for signing in without the app, e.g. after losing the phone. Each one works once.
export function generateRecoveryCodes(count = 10): string[] {
  const codes = new Set<string>()
  while (codes.size < count) {
    const chars = Array.from({ length: 10 }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join("")
    codes.add(`${chars.slice(0, 5)}-${chars.slice(5)}`)
  }
  return [...codes]
}

// Recovery codes are stored as hashes only. Case, spaces and the dash do not matter when typing one.
export function hashRecoveryCode(input: string): string {
  return createHash("sha256").update(input.toLowerCase().replace(/[\s-]/g, "")).digest("hex")
}

function secretKey(key: string): Buffer {
  return Buffer.from(hkdfSync("sha256", key, "", "totp-secret", 32))
}

// The secret is stored encrypted (AES-256-GCM), so a copy of the database alone yields no codes
export function encryptSecret(secret: string, key: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", secretKey(key), iv)
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64")
}

// Null if the stored value was not encrypted with this key or has been changed
export function decryptSecret(stored: string, key: string): string | null {
  try {
    const raw = Buffer.from(stored, "base64")
    const decipher = createDecipheriv("aes-256-gcm", secretKey(key), raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")
  } catch {
    return null
  }
}

// Admins have to use two-factor sign-in; for everyone else it is voluntary
export function totpRequiredForRole(role?: string | null): boolean {
  return role === "ADMIN"
}

const MAX_WRONG_CODES = 5
const LOCK_MS = 15 * 60_000

// Guessing a six-digit code must not be possible: after five wrong codes in a row the second
// step is locked for 15 minutes. Returns the new count and the end of the lock, if any.
export function afterWrongCode(failures: number, now: Date): { failures: number; lockedUntil: Date | null } {
  if (failures + 1 < MAX_WRONG_CODES) return { failures: failures + 1, lockedUntil: null }
  return { failures: 0, lockedUntil: new Date(now.getTime() + LOCK_MS) }
}
