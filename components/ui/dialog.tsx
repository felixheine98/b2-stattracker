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
    <div className="fixed inset-0 z-9999 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-xl border border-[#2d2829] bg-[#1c1819] p-6 shadow-2xl",
          className
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[#9a9090] hover:text-[#f5f0f0] transition-colors"
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
  return <h2 className={cn("text-lg font-semibold text-[#f5f0f0] mb-4", className)} {...props} />
}
