"use client"

import { useId, useState, useSyncExternalStore } from "react"
import { Check, Monitor, Palette } from "lucide-react"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { ThemeChoice } from "@/lib/theme"
import { currentThemeChoice, selectTheme, THEME_CHANGE_EVENT } from "./theme-toggle"

const options: { value: ThemeChoice; label: string; description: string; bg: string; surface: string; fg: string }[] = [
  { value: "dark", label: "B2 Dark", description: "Classic dark with B2 yellow", bg: "#0e0b0b", surface: "#251f20", fg: "#f5f0f0" },
  { value: "light", label: "B2 Light", description: "Warm white with B2 colours", bg: "#f4f2ee", surface: "#ffffff", fg: "#1a1718" },
  { value: "warm-light", label: "Warm Light", description: "Soft cream with warm surfaces and B2 blue", bg: "#f6efdf", surface: "#ede2ce", fg: "#33291f" },
  { value: "b2-blue", label: "B2 Blue", description: "Bold team blue with yellow highlights", bg: "#00164f", surface: "#103da0", fg: "#f3f6ff" },
  { value: "midnight", label: "Midnight", description: "Deep navy with cool blue surfaces", bg: "#0b1224", surface: "#1b2942", fg: "#eef3fc" },
  { value: "oled", label: "OLED Black", description: "Pure black with subtle grey surfaces", bg: "#000000", surface: "#171717", fg: "#f5f5f5" },
  { value: "system", label: "Follow system", description: "B2 Light or Dark to match your device", bg: "#0e0b0b", surface: "#f4f2ee", fg: "#f5f0f0" },
]

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange)
  return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange)
}

export function ThemePicker({ collapsed = false }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const choice = useSyncExternalStore(subscribe, currentThemeChoice, () => "dark" as ThemeChoice)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={collapsed ? "Appearance" : undefined}
        aria-label="Appearance"
        className={cn(
          "flex w-full items-center gap-3 rounded-md py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-raised hover:text-fg max-md:py-2.5",
          collapsed ? "justify-center px-0" : "px-3"
        )}
      >
        <Palette size={16} className="shrink-0" />
        {!collapsed && "Appearance"}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <div role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <DialogTitle id={titleId}>Appearance</DialogTitle>
          <p className="mb-4 text-sm text-fg-muted">Your choice is saved in this browser.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-label={option.label}
                aria-describedby={`${titleId}-${option.value}`}
                aria-pressed={choice === option.value}
                title={option.description}
                onClick={() => selectTheme(option.value)}
                className={cn(
                  "flex min-h-14 min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-h-26 sm:flex-col sm:items-stretch sm:gap-2",
                  choice === option.value ? "border-brand/60 bg-brand/10" : "border-line hover:bg-raised"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "my-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 shadow-[inset_0_-5px_10px_rgb(0_0_0/0.2),0_2px_5px_rgb(0_0_0/0.15)] sm:mx-auto sm:h-12 sm:w-12",
                    choice === option.value && "ring-2 ring-brand ring-offset-2 ring-offset-surface"
                  )}
                  style={{ background: option.value === "system"
                    ? "linear-gradient(135deg, #f4f2ee 0%, #f4f2ee 48%, #251f20 52%, #0e0b0b 100%)"
                    : `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${option.surface} 65%, ${option.fg}) 0%, ${option.surface} 40%, ${option.bg} 85%)` }}
                >
                  {option.value === "system" && <Monitor size={18} className="rounded bg-black/50 p-0.5 text-white" />}
                </span>
                <span className="flex w-full items-center justify-between gap-1 sm:mt-auto">
                  <span className="text-xs font-medium text-fg">{option.label}</span>
                  {choice === option.value && <Check size={14} aria-hidden="true" className="shrink-0 text-brand-ink" />}
                </span>
                <span id={`${titleId}-${option.value}`} className="sr-only">{option.description}</span>
              </button>
            ))}
          </div>
          <div className="dialog-footer mt-5 flex justify-end">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover">Done</button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
