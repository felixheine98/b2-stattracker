import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server"
import { isoBase64URL } from "@simplewebauthn/server/helpers"
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture, RegistrationResponseJSON } from "@simplewebauthn/types"
import { db } from "./db"
import { relyingParty } from "./mfa"

// Passkeys (WebAuthn): the device proves it holds the key and that its owner unlocked it
// (fingerprint, face, PIN). That is possession plus a second factor, so a passkey signs in on its own.

const CHALLENGE_MS = 5 * 60_000
export const MAX_PASSKEYS = 10

function site() {
  return relyingParty(process.env.AUTH_URL)
}

// Every ceremony starts with a challenge that is valid once and for a few minutes
async function saveChallenge(challenge: string, userId: string | null) {
  const now = new Date()
  await db.passkeyChallenge.deleteMany({ where: { expiresAt: { lt: now } } })
  await db.passkeyChallenge.create({ data: { challenge, userId, expiresAt: new Date(now.getTime() + CHALLENGE_MS) } })
}

async function redeemChallenge(challenge: string, userId: string | null): Promise<boolean> {
  const used = await db.passkeyChallenge.deleteMany({ where: { challenge, userId, expiresAt: { gt: new Date() } } })
  return used.count === 1
}

// What the browser needs to create a passkey for the account
export async function passkeyRegistrationOptions(user: { id: string; username: string; name: string }) {
  const existing = await db.passkey.findMany({ where: { userId: user.id }, select: { credentialId: true, transports: true } })
  const options = await generateRegistrationOptions({
    rpName: "B2 Stats",
    rpID: site().rpID,
    userID: user.id,
    userName: user.username,
    userDisplayName: user.name,
    attestationType: "none",
    // A device that already holds a passkey of this account does not get a second one
    excludeCredentials: existing.map((p) => ({
      id: isoBase64URL.toBuffer(p.credentialId),
      type: "public-key",
      transports: p.transports as AuthenticatorTransportFuture[],
    })),
    // Stored on the device, so signing in needs no username; and always with the device unlocked
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  })
  await saveChallenge(options.challenge, user.id)
  return options
}

// Stores the passkey the browser created. False if the answer does not belong to a challenge
// handed out to this account or does not check out.
export async function addPasskey(userId: string, response: RegistrationResponseJSON, name: string): Promise<boolean> {
  try {
    const { rpID, origin } = site()
    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response,
      expectedChallenge: (challenge) => redeemChallenge(challenge, userId),
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    })
    if (!verified || !registrationInfo) return false
    await db.passkey.create({
      data: {
        userId,
        name,
        credentialId: isoBase64URL.fromBuffer(registrationInfo.credentialID),
        publicKey: Buffer.from(registrationInfo.credentialPublicKey),
        counter: registrationInfo.counter,
        transports: response.response.transports ?? [],
      },
    })
    return true
  } catch {
    return false
  }
}

// What the browser needs to sign in with a passkey. Nobody is named: the device offers the
// passkeys it holds for this site.
export async function passkeyLoginOptions() {
  const options = await generateAuthenticationOptions({ rpID: site().rpID, userVerification: "required" })
  await saveChallenge(options.challenge, null)
  return options
}

// The account a passkey sign-in belongs to, or null if it does not check out
export async function verifyPasskeyLogin(response: AuthenticationResponseJSON) {
  try {
    const passkey = await db.passkey.findUnique({ where: { credentialId: response.id }, include: { user: true } })
    if (!passkey) return null
    const { rpID, origin } = site()
    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response,
      expectedChallenge: (challenge) => redeemChallenge(challenge, null),
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      authenticator: {
        credentialID: isoBase64URL.toBuffer(passkey.credentialId),
        credentialPublicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: passkey.transports as AuthenticatorTransportFuture[],
      },
    })
    if (!verified) return null
    await db.passkey.update({ where: { id: passkey.id }, data: { counter: authenticationInfo.newCounter, lastUsedAt: new Date() } })
    return passkey.user
  } catch {
    return null
  }
}
