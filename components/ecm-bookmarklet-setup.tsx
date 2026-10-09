"use client"

import { BASE_PATH } from "@/lib/base-path"
import { ECM_IMPORT_PATH, ecmBookmarkletUrl } from "@/lib/ecm"
import { useState } from "react"

// The bookmarklet opens the import page of whatever address the app is reached under
const bookmarkletUrl = () => ecmBookmarkletUrl(`${window.location.origin}${BASE_PATH}${ECM_IMPORT_PATH}`)

// How to get the eCM bookmarklet: the link to drag or copy, and the steps on a computer and on a phone
export function EcmBookmarkletSetup() {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")

  // React refuses javascript: URLs in JSX, so the link is set on the element directly
  const setHref = (el: HTMLAnchorElement | null) => {
    el?.setAttribute("href", bookmarkletUrl())
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(bookmarkletUrl())
      setCopied(true)
      setError("")
    } catch {
      setError("Kopieren nicht möglich – bitte den Link in die Lesezeichenleiste ziehen.")
    }
  }

  return (
    <div className="space-y-3 text-sm text-[#c5bfbf]">
      <div className="flex flex-wrap items-center gap-2">
        <a
          ref={setHref}
          onClick={(e) => e.preventDefault()}
          className="inline-block cursor-grab rounded-md border border-[#FBD00D]/50 bg-[#FBD00D]/10 px-2.5 py-1 text-xs font-medium text-[#FBD00D]"
        >
          eCM → B2 Stats
        </a>
        <button type="button" onClick={copy} className="rounded-md border border-[#3a3435] px-2.5 py-1 text-xs text-[#f5f0f0] hover:bg-[#251f20]">
          {copied ? "Adresse kopiert ✓" : "Adresse kopieren"}
        </button>
      </div>
      {error && <p className="text-xs text-[#ED1F24]">{error}</p>}

      <details className="rounded-lg border border-[#2d2829] px-3 py-2" open>
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[#9a9090]">Am Rechner</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          <li>Den gelben Link in die Lesezeichenleiste ziehen (einblenden mit ⌘⇧B bzw. Strg+Umschalt+B).</li>
          <li>Die Match-Seite auf ecircuitmania.com öffnen und das Lesezeichen anklicken.</li>
          <li>Du landest hier in B2 Stats und bestätigst nur noch Match und Zuordnung.</li>
        </ol>
      </details>

      <details className="rounded-lg border border-[#2d2829] px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[#9a9090]">Auf dem Handy</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          <li>Oben auf „Adresse kopieren“ tippen.</li>
          <li>
            <strong>iPhone (Safari):</strong> Irgendeine Seite über das Seiten-Menü zu den Favoriten hinzufügen („Add to
            Favourites“). Dann in die Adresszeile tippen, die neue Favoriten-Kachel lange gedrückt halten und „Edit“
            wählen: als Namen „eCM“ eintragen und die Adresse durch die kopierte ersetzen.
          </li>
          <li>
            <strong>Android (Chrome):</strong> Irgendeine Seite als Lesezeichen sichern (Menü → Stern), das Lesezeichen
            bearbeiten, „eCM“ nennen und die Adresse durch die kopierte ersetzen.
          </li>
          <li>
            Auf der eCM-Match-Seite starten. Safari: in die Adresszeile tippen und die Kachel „eCM“ antippen. Chrome: in
            die Adresszeile „eCM“ tippen und das Lesezeichen in den Vorschlägen antippen.
          </li>
          <li className="list-none text-xs text-[#5e5858]">
            Die kopierte Adresse selbst in die Adresszeile einzufügen funktioniert nicht – das blockiert der Browser.
          </li>
        </ol>
      </details>
    </div>
  )
}
