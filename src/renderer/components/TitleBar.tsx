// src/renderer/components/TitleBar.tsx
import React from 'react'

export function TitleBar() {
  return (
    <div
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      className="h-10 flex items-center justify-between px-4 select-none bg-transparent border-b border-gray-100/10"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase">Lexio</span>
      </div>
      
      <div 
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => window.lexio.minimizeWindow()}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors group"
          title="Minimizar"
        >
          <div className="w-3 h-[1px] bg-gray-400 group-hover:bg-gray-600" />
        </button>
        <button
          onClick={() => window.lexio.closeWindow()}
          className="w-8 h-8 flex items-center justify-center hover:bg-red-50 rounded-full transition-colors group text-gray-400 hover:text-red-500 text-lg"
          title="Fechar"
        >
          ×
        </button>
      </div>
    </div>
  )
}
