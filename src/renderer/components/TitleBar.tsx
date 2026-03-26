import React from 'react'
import wordmark from '../../assets/lexio-wordmark.png'

export function TitleBar() {
  return (
    <div
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      className="bg-surface-sunken border-b border-border-subtle py-2 px-4 flex items-center justify-between select-none"
    >
      <img src={wordmark} alt="Lexio" className="h-6 opacity-90" />
      <div className="flex gap-2">
        <button
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => window.lexio.minimizeWindow()}
          className="w-2.75 h-2.75 rounded-full bg-window-min hover:bg-window-min-hover border-none cursor-pointer transition-colors"
          title="Minimizar"
        />
        <button
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => window.lexio.closeWindow()}
          className="w-2.75 h-2.75 rounded-full bg-window-close hover:bg-window-close-hover border-none cursor-pointer transition-colors"
          title="Fechar"
        />
      </div>
    </div>
  )
}
