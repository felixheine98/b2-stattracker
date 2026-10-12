import { describe, expect, it } from "vitest"
import {
  afterWrongCode,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateSecret,
  hashRecoveryCode,
  isTotpCode,
  matchTotp,
  otpauthUri,
  totpCode,
  totpRequiredForRole,
} from "./totp"

// The secret of the RFC 6238 test vectors ("12345678901234567890") in base32
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"

describe("totpCode", () => {
  it("matches the RFC 6238 test vectors", () => {
    expect(totpCode(RFC_SECRET, 59_000)).toBe("287082")
    expect(totpCode(RFC_SECRET, 1111111109_000)).toBe("081804")
    expect(totpCode(RFC_SECRET, 1111111111_000)).toBe("050471")
    expect(totpCode(RFC_SECRET, 1234567890_000)).toBe("005924")
    expect(totpCode(RFC_SECRET, 2000000000_000)).toBe("279037")
  })

  it("reads secrets in lower case and with spaces", () => {
    expect(totpCode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq", 59_000)).toBe("287082")
  })
})

describe("matchTotp", () => {
  const now = 1111111111_000
  const step = Math.floor(now / 30_000)

  it("accepts the current code and returns its time step", () => {
    expect(matchTotp(RFC_SECRET, "050471", now)).toBe(step)
    expect(matchTotp(RFC_SECRET, " 050 471 ", now)).toBe(step)
  })

  it("accepts the code of the step before and after, for clocks that are slightly off", () => {
    expect(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, now - 30_000), now)).toBe(step - 1)
    expect(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, now + 30_000), now)).toBe(step + 1)
  })

  it("refuses older codes, wrong codes and anything that is not six digits", () => {
    expect(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, now - 60_000), now)).toBeNull()
    expect(matchTotp(RFC_SECRET, "000000", now)).toBeNull()
    expect(matchTotp(RFC_SECRET, "50471", now)).toBeNull()
    expect(matchTotp(RFC_SECRET, "", now)).toBeNull()
  })

  it("refuses a code that was already used", () => {
    expect(matchTotp(RFC_SECRET, "050471", now, step)).toBeNull()
    expect(matchTotp(RFC_SECRET, "050471", now, step - 1)).toBe(step)
    expect(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, now - 30_000), now, step)).toBeNull()
  })
})

describe("generateSecret", () => {
  it("is 160 bits in base32 and different every time", () => {
    const a = generateSecret()
    expect(a).toMatch(/^[A-Z2-7]{32}$/)
    expect(generateSecret()).not.toBe(a)
    expect(matchTotp(a, totpCode(a, 0), 0)).toBe(0)
  })
})

describe("otpauthUri", () => {
  it("is the address an authenticator app reads from the QR code", () => {
    expect(otpauthUri(RFC_SECRET, "felix", "B2 Stats")).toBe(
      `otpauth://totp/B2%20Stats:felix?secret=${RFC_SECRET}&issuer=B2%20Stats&algorithm=SHA1&digits=6&period=30`
    )
  })
})

describe("isTotpCode", () => {
  it("tells a code from the app apart from a recovery code", () => {
    expect(isTotpCode("123456")).toBe(true)
    expect(isTotpCode("123 456")).toBe(true)
    expect(isTotpCode("abcde-fghjk")).toBe(false)
    expect(isTotpCode("1234567")).toBe(false)
  })
})

describe("recovery codes", () => {
  it("come as ten different codes that are easy to type", () => {
    const codes = generateRecoveryCodes()
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    for (const code of codes) expect(code).toMatch(/^[a-hjkmnp-z2-9]{5}-[a-hjkmnp-z2-9]{5}$/)
  })

  it("hash the same however they are typed", () => {
    expect(hashRecoveryCode("abcde-fghjk")).toMatch(/^[0-9a-f]{64}$/)
    expect(hashRecoveryCode(" ABCDE fghjk ")).toBe(hashRecoveryCode("abcde-fghjk"))
    expect(hashRecoveryCode("abcdefghjk")).toBe(hashRecoveryCode("abcde-fghjk"))
    expect(hashRecoveryCode("abcde-fghjm")).not.toBe(hashRecoveryCode("abcde-fghjk"))
  })
})

describe("encryptSecret", () => {
  it("round-trips with the same key and hides the secret", () => {
    const stored = encryptSecret(RFC_SECRET, "key-one")
    expect(stored).not.toContain(RFC_SECRET)
    expect(decryptSecret(stored, "key-one")).toBe(RFC_SECRET)
    expect(encryptSecret(RFC_SECRET, "key-one")).not.toBe(stored)
  })

  it("gives nothing back with another key or a changed value", () => {
    const stored = encryptSecret(RFC_SECRET, "key-one")
    expect(decryptSecret(stored, "key-two")).toBeNull()
    expect(decryptSecret(stored.slice(0, -2) + "AA", "key-one")).toBeNull()
    expect(decryptSecret("nonsense", "key-one")).toBeNull()
  })
})

describe("totpRequiredForRole", () => {
  it("is required for admins and voluntary for everyone else", () => {
    expect(totpRequiredForRole("ADMIN")).toBe(true)
    expect(totpRequiredForRole("MANAGER")).toBe(false)
    expect(totpRequiredForRole("PLAYER")).toBe(false)
    expect(totpRequiredForRole(undefined)).toBe(false)
  })
})

describe("afterWrongCode", () => {
  const now = new Date("2026-10-12T12:00:00Z")

  it("counts wrong codes without locking at first", () => {
    expect(afterWrongCode(0, now)).toEqual({ failures: 1, lockedUntil: null })
    expect(afterWrongCode(3, now)).toEqual({ failures: 4, lockedUntil: null })
  })

  it("locks the second step for 15 minutes after the fifth wrong code and starts counting again", () => {
    expect(afterWrongCode(4, now)).toEqual({ failures: 0, lockedUntil: new Date("2026-10-12T12:15:00Z") })
  })
})
