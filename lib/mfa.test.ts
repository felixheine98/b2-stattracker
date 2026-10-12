import { describe, expect, it } from "vitest"
import { needsMfaSetup, passwordNeedsPasskey, relyingParty } from "./mfa"

describe("needsMfaSetup", () => {
  it("sends an admin with neither an authenticator app nor a passkey to the setup", () => {
    expect(needsMfaSetup({ role: "ADMIN", totp: false, passkeys: 0 })).toBe(true)
  })

  it("is satisfied by either of the two", () => {
    expect(needsMfaSetup({ role: "ADMIN", totp: true, passkeys: 0 })).toBe(false)
    expect(needsMfaSetup({ role: "ADMIN", totp: false, passkeys: 1 })).toBe(false)
  })

  it("never applies to accounts for which it is voluntary", () => {
    expect(needsMfaSetup({ role: "MANAGER", totp: false, passkeys: 0 })).toBe(false)
    expect(needsMfaSetup({ role: "PLAYER", totp: false, passkeys: 0 })).toBe(false)
  })
})

describe("passwordNeedsPasskey", () => {
  it("refuses the password alone for an admin whose only second factor is a passkey", () => {
    expect(passwordNeedsPasskey({ role: "ADMIN", totp: false, passkeys: 2 })).toBe(true)
  })

  it("lets an admin with an authenticator app go on to the code", () => {
    expect(passwordNeedsPasskey({ role: "ADMIN", totp: true, passkeys: 1 })).toBe(false)
  })

  it("lets an admin without anything in, who then lands in the setup", () => {
    expect(passwordNeedsPasskey({ role: "ADMIN", totp: false, passkeys: 0 })).toBe(false)
  })

  it("leaves the password to everyone else, for whom a passkey is a convenience", () => {
    expect(passwordNeedsPasskey({ role: "PLAYER", totp: false, passkeys: 1 })).toBe(false)
    expect(passwordNeedsPasskey({ role: "MANAGER", totp: false, passkeys: 1 })).toBe(false)
  })
})

describe("relyingParty", () => {
  it("takes the site passkeys belong to from the address of the sign-in", () => {
    expect(relyingParty("https://b2-esports.com/api/auth")).toEqual({ rpID: "b2-esports.com", origin: "https://b2-esports.com" })
    expect(relyingParty("http://localhost:3050/stats/api/auth")).toEqual({ rpID: "localhost", origin: "http://localhost:3050" })
  })

  it("fails without an address instead of accepting passkeys from anywhere", () => {
    expect(() => relyingParty(undefined)).toThrow()
    expect(() => relyingParty("")).toThrow()
  })
})
