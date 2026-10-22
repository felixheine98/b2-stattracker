"use client"

import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { HTMLAttributes, useEffect, useState } from "react"
import { createPortal } from "react-dom"

interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export function Dialog({ open, onClose, children, className }: DialogProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // The portal needs document.body after hydration; the server must render nothing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!mounted || !open) return null

  return createPortal(
    // On phones a dialog fills the screen; its content scrolls and the buttons (.dialog-footer) stay at the bottom
    <div className="fixed inset-0 z-9999 flex items-stretch justify-center md:items-center md:p-4">
      <div className="absolute inset-0 bg-[#07142b]/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 w-full max-w-md overflow-y-auto overflow-x-hidden rounded-xl border border-line bg-surface p-6 shadow-2xl md:max-h-full",
          "max-md:max-w-none max-md:rounded-none max-md:border-0 max-md:p-4",
          className
        )}
      >
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-md text-fg-muted hover:text-fg transition-colors"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>,
    document.body
  )
}

export function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("pr-10 text-xl font-semibold text-fg mb-6", className)} {...props} />
}
