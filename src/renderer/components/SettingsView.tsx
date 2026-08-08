import React, { useEffect, useState } from 'react'
import { invoke } from '../lib/tauri-bridge'

export function SettingsView() {
  const [version, setVersion] = useState('')

  useEffect(() => {
    invoke<string>('get_app_version').then(setVersion)
  }, [])

  return (
    <div className="flex flex-col gap-6 word-card-enter">
      <div className="h-px bg-border-muted" />

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="font-sans text-xs text-text-secondary">Lexio</span>
          <span className="font-mono text-label text-text-faint bg-surface-sunken px-2 py-0.5 rounded">
            v{version || '...'}
          </span>
        </div>
      </div>
    </div>
  )
}
