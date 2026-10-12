import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      // A second factor (authenticator app or passkey) is required for this account but not set up yet
      mfaSetupRequired: boolean
    } & DefaultSession["user"]
  }
}
