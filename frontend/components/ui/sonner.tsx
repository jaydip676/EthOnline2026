"use client"

import type { CSSProperties } from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

function ToastSpinner() {
  return (
    <svg className="size-4 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" className="stroke-current/25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" className="stroke-current" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      closeButton
      theme="light"
      className="toaster group"
      position="bottom-right"
      offset={20}
      gap={10}
      duration={4200}
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-primary" />,
        warning: <TriangleAlertIcon className="size-4 text-cta" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <ToastSpinner />,
      }}
      toastOptions={{
        classNames: {
          toast: "glass text-foreground",
          title: "text-sm font-medium",
          description: "text-xs text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground",
          cancelButton: "!bg-secondary !text-secondary-foreground",
        },
      }}
      style={
        {
          "--normal-bg": "color-mix(in srgb, var(--popover) 92%, transparent)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "color-mix(in srgb, var(--popover) 88%, var(--success) 12%)",
          "--error-bg": "color-mix(in srgb, var(--popover) 88%, var(--destructive) 12%)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
