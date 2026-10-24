import type { Metadata } from "next"
import Link from "next/link"
import { BrandLogo } from "@/components/brand-logo"

export const metadata: Metadata = { title: "Privacy policy · B2 Stats" }

// Who answers questions about this policy (set by Felix on 24.10.2026)
const CONTACT: { name: string; email: string | null } = { name: "Felix Heine (aka Shoffy, B2 eSports)", email: "contact@b2-esports.com" }
const UPDATED = "24 October 2026"

// Public: Google links here from the sign-in for the team's YouTube channel (docs/adr/011-vod-archiv.md)
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-10">
      <article className="page-narrow mx-auto space-y-6 text-sm leading-relaxed text-fg-soft [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-fg [&_a]:text-brand-ink [&_a]:underline [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        <header className="flex items-center gap-3">
          <BrandLogo className="h-12 w-10 object-contain" />
          <div>
            <h1 className="text-xl font-semibold text-fg">Privacy policy</h1>
            <p className="text-xs text-fg-muted">B2 Stats · last updated {UPDATED}</p>
          </div>
        </header>

        <p>
          B2 Stats is the internal stat tracker of the Trackmania team B2 eSports. It is used by the team&apos;s players and managers to record match results, plan lineups and keep
          recordings of matches. This policy explains which data the app processes, in particular the data it receives from Google when the team connects its YouTube channel.
        </p>

        <h2>Who is responsible</h2>
        <p>
          {CONTACT.name}
          {CONTACT.email && <>, contact: <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></>}
        </p>

        <h2>Accounts of team members</h2>
        <p>
          Signing in requires an account created by the team&apos;s admins. The app stores the account name, a hashed password or passkey, the role in the team and the
          player&apos;s match results. A session cookie keeps you signed in; there are no tracking or advertising cookies.
        </p>

        <h2>YouTube and Google data</h2>
        <p>
          Admins can connect the team&apos;s YouTube channel so that the app can archive recordings of matches: it cuts the part of a Twitch broadcast that shows a match and
          uploads it to the team&apos;s channel. The app uses the YouTube API Services for this. By connecting a channel you agree to the{" "}
          <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>; Google processes data as described in the{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.
        </p>
        <ul>
          <li>
            <strong className="text-fg">What the app receives:</strong> an access token for the Google account that connects the channel, with permission to upload, update and delete
            videos on that channel. It does not read your email, contacts, subscriptions, watch history or any other data of the account.
          </li>
          <li>
            <strong className="text-fg">What it is used for:</strong> only to upload match recordings to the team&apos;s channel as unlisted (or private) videos and to replace a recording
            when the range of a match changes. Uploaded videos are shown on the match&apos;s page in the app.
          </li>
          <li>
            <strong className="text-fg">Sharing:</strong> the token and the data from Google are not shared with anyone, not sold and not used for advertising.
          </li>
          <li>
            <strong className="text-fg">Storage:</strong> the token is stored in the app&apos;s database on the team&apos;s own server until an admin disconnects the channel; then it is
            deleted. The recordings themselves are stored by YouTube, not by the app; files are only kept on the server while a recording is being cut and uploaded.
          </li>
          <li>
            <strong className="text-fg">Revoking access:</strong> disconnect the channel in the app&apos;s admin settings, or revoke access at any time in your Google account under{" "}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">Security → Third-party access</a>.
          </li>
        </ul>

        <h2>Embedded players</h2>
        <p>
          Match pages can embed the Twitch player and, for archived recordings, the YouTube player. The YouTube player is only loaded after you click on it, via
          youtube-nocookie.com. Once loaded, Twitch and YouTube process data according to their own privacy policies.
        </p>

        <h2>Your rights</h2>
        <p>
          You can ask for access to, correction or deletion of your data, and object to its processing, by writing to the contact above. You also have the right to lodge a
          complaint with a data protection authority.
        </p>

        <p className="pt-4">
          <Link href="/dashboard">← Back to B2 Stats</Link>
        </p>
      </article>
    </main>
  )
}
