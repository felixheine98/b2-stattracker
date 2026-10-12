import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { MfaSetupView } from "./mfa-setup-view"

// Where an account that has to use two-factor sign-in lands until it is set up (see proxy.ts).
// Everyone else sets it up from the account menu.
export default async function MfaSetupPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!session.user.mfaSetupRequired) redirect("/dashboard")

  return <MfaSetupView />
}
