// src/renderer/components/UpdateBanner.tsx
import React from 'react'
import { useAutoUpdater } from '../hooks/useAutoUpdater'

export function UpdateBanner() {
  const { update, install } = useAutoUpdater()

  if (update.status === 'idle') return null

  if (update.status === 'available') {
    return (
      <div className="bg-surface-sunken border-t border-border-subtle px-5 py-2 flex items-center justify-between shrink-0">
        <span className="font-sans text-label text-text-muted">
          v{update.version} disponivel — baixando...
        </span>
      </div>
    )
  }

  if (update.status === 'progress') {
    return (
      <div className="bg-surface-sunken border-t border-border-subtle px-5 py-2 shrink-0">
        <div className="w-full bg-border-subtle rounded-sm h-0.5">
          <div
            className="bg-text-muted h-0.5 rounded-sm transition-all duration-300"
            style={{ width: `${update.pct}%` }}
          />
        </div>
      </div>
    )
  }

  if (update.status === 'downloaded') {
    return (
      <div className="bg-surface-sunken border-t border-border-subtle px-5 py-2 flex items-center justify-between shrink-0">
        <span className="font-sans text-label text-text-muted">
          v{update.version} pronta para instalar
        </span>
        <button
          onClick={install}
          className="font-sans text-label text-text-secondary border border-border-subtle rounded px-2 py-0.5 cursor-pointer transition-colors hover:text-text-primary hover:border-text-faint"
        >
          Reiniciar
        </button>
      </div>
    )
  }

  return null
}
