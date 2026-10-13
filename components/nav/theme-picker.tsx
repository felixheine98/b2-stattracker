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
          <p className="mb-4 text-sm text-fg-muted">Choose a theme. Your choice is saved in this browser.</p>
          <div className="space-y-2">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={choice === option.value}
                onClick={() => selectTheme(option.value)}
                className={cn(
                  "flex min-h-16 w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  choice === option.value ? "border-brand/60 bg-brand/10" : "border-line hover:bg-raised"
                )}
              >
                <span aria-hidden="true" className="flex h-10 w-14 shrink-0 items-center gap-1 rounded-md border border-white/20 p-1.5" style={{ background: option.bg }}>
                  {option.value === "system" ? <Monitor size={24} style={{ color: option.fg }} /> : (
                    <>
                      <span className="h-full w-2 rounded-sm bg-[#FBD00D]" />
                      <span className="flex flex-1 flex-col gap-1 rounded-sm p-1" style={{ background: option.surface }}>
                        <span className="h-0.5 rounded" style={{ background: option.fg }} />
                        <span className="h-0.5 w-2/3 rounded bg-[#FBD00D]" />
                      </span>
                    </>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-fg">{option.label}</span>
                  <span className="block text-xs text-fg-muted">{option.description}</span>
                </span>
                {choice === option.value && <Check size={18} aria-hidden="true" className="shrink-0 text-brand-ink" />}
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
