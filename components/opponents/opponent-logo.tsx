"use client"
import { useState } from "react"
import Image from "next/image"
export function OpponentLogo({ name, logo, size = 40 }: { name: string; logo?: string | null; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null)
  return logo && logo !== failed ? <Image src={logo} alt={`${name} Logo`} width={size} height={size} unoptimized onError={() => setFailed(logo)} className="shrink-0 rounded-lg object-contain" style={{ width: size, height: size }} />
    : <span className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[#3a3435] bg-[#251f20] text-sm font-semibold text-[#FBD00D]" style={{ width: size, height: size }}>{name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase()}</span>
}
