// src/renderer/components/StatusBar.tsx
import React from 'react'
import tray from '../../assets/lexio-tray-32.png'

interface StatusBarProps {
  version: string
}

export function StatusBar({ version }: StatusBarProps) {
  return (
    <footer className="bg-surface-sunken border-t border-border-subtle py-2.5 px-5 flex items-center justify-center shrink-0 select-none">
      <span className="font-sans text-[10px] text-text-faint tracking-[0.5px] uppercase flex items-center gap-2">
        <img src={tray} alt="Lexio" className="h-5" /> v{version}
      </span>
    </footer>
  )
}
