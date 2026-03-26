// src/renderer/components/Nav.tsx
import React from 'react'

type View = 'search' | 'saved' | 'history'

interface NavProps {
  activeView: View
  setActiveView: (view: View) => void
}

export function Nav({ activeView, setActiveView }: NavProps) {
  const views: { id: View; label: string }[] = [
    { id: 'search', label: 'Busca' },
    { id: 'saved', label: 'Salvos' },
    { id: 'history', label: 'Histórico' }
  ]

  return (
    <nav className="bg-surface-sunken border-b border-border-subtle h-[38px] px-5 flex items-center gap-1 shrink-0">
      {views.map((view) => (
        <button
          key={view.id}
          className={`font-sans text-[12px] font-medium px-[14px] h-full border-b-2 bg-transparent cursor-pointer tracking-[0.2px] transition-all duration-150 ${
            activeView === view.id
              ? 'text-text-primary border-b-text-primary'
              : 'text-text-muted border-b-transparent hover:text-text-secondary'
          }`}
          onClick={() => setActiveView(view.id)}
        >
          {view.label}
        </button>
      ))}
    </nav>
  )
}

