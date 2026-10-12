import { passkeyLoginOptions } from "@/lib/passkey-db"
import { NextResponse } from "next/server"

// Start a sign-in with a passkey. Open to everyone, as it is asked for before signing in (see proxy.ts).
export async function POST() {
  return NextResponse.json(await passkeyLoginOptions())
}
