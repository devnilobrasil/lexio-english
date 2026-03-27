// src/renderer/components/WindowControls.tsx
import React from 'react'

export function WindowControls() {
  return (
    <div
      className="flex gap-1.5 ml-2 shrink-0"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <button
        onClick={() => window.lexio.minimizeWindow()}
        className="w-2.75 h-2.75 rounded-full bg-window-min hover:bg-window-min-hover border-none cursor-pointer transition-colors"
        title="Minimizar"
      />
      <button
        onClick={() => window.lexio.closeWindow()}
        className="w-2.75 h-2.75 rounded-full bg-window-close hover:bg-window-close-hover border-none cursor-pointer transition-colors"
        title="Fechar"
      />
    </div>
  )
}
