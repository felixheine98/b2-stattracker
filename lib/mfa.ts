import { totpRequiredForRole } from "./totp"

// What an account has set up beyond its password
interface Factors {
  role?: string | null
  // An authenticator app is set up
  totp: boolean
  // Number of passkeys
  passkeys: number
}

// An account that has to use a second factor (see totpRequiredForRole) but has neither an
// authenticator app nor a passkey gets nowhere until one of them is set up
export function needsMfaSetup({ role, totp, passkeys }: Factors): boolean {
  return totpRequiredForRole(role) && !totp && passkeys === 0
}

// Such an account with passkeys but no authenticator app cannot sign in with the password
// alone: the passkey is its second factor. Where it is voluntary the password still works.
export function passwordNeedsPasskey({ role, totp, passkeys }: Factors): boolean {
  return totpRequiredForRole(role) && !totp && passkeys > 0
}

// Passkeys are tied to one site. Which one follows from the address the sign-in runs under (AUTH_URL).
export function relyingParty(authUrl: string | undefined): { rpID: string; origin: string } {
  if (!authUrl) throw new Error("AUTH_URL is not set")
  const url = new URL(authUrl)
  return { rpID: url.hostname, origin: url.origin }
}
