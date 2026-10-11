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
      setError("Copying is not possible – please drag the link into the bookmarks bar.")
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
          {copied ? "Address copied ✓" : "Copy address"}
        </button>
      </div>
      {error && <p className="text-xs text-[#ED1F24]">{error}</p>}

      <details className="rounded-lg border border-[#2d2829] px-3 py-2" open>
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[#9a9090]">On a computer</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          <li>Drag the yellow link into the bookmarks bar (show it with ⌘⇧B or Ctrl+Shift+B).</li>
          <li>Open the match page on ecircuitmania.com and click the bookmark.</li>
          <li>You end up here in B2 Stats and only confirm match and assignment.</li>
        </ol>
      </details>

      <details className="rounded-lg border border-[#2d2829] px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[#9a9090]">On a phone</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          <li>Tap “Copy address” above.</li>
          <li>
            <strong>iPhone (Safari):</strong> Add any page to the favourites through the page menu (“Add to
            Favourites”). Then tap the address bar, hold the new favourite tile and pick “Edit”:
            enter “eCM” as the name and replace the address with the copied one.
          </li>
          <li>
            <strong>Android (Chrome):</strong> Save any page as a bookmark (menu → star), edit the bookmark,
            name it “eCM” and replace the address with the copied one.
          </li>
          <li>
            Start it on the eCM match page. Safari: tap the address bar and tap the tile “eCM”. Chrome: type
            “eCM” into the address bar and tap the bookmark among the suggestions.
          </li>
          <li className="list-none text-xs text-[#5e5858]">
            Pasting the copied address into the address bar yourself does not work – the browser blocks that.
          </li>
        </ol>
      </details>
    </div>
  )
}
