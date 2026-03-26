// src/renderer/components/Nav.tsx
import React from 'react'
import { useTranslation } from 'react-i18next'
import { LocaleSelect } from './LocaleSelect'

type View = 'search' | 'saved' | 'history'

interface NavProps {
  activeView: View
  setActiveView: (view: View) => void
}

export function Nav({ activeView, setActiveView }: NavProps) {
  const { t } = useTranslation()

  const views: { id: View; label: string }[] = [
    { id: 'search',  label: t('nav.search')  },
    { id: 'saved',   label: t('nav.saved')   },
    { id: 'history', label: t('nav.history') },
  ]

  return (
    <nav className="bg-surface-sunken border-b border-border-subtle h-nav px-5 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-1 h-full">
        {views.map((view) => (
          <button
            key={view.id}
            data-testid={`nav-${view.id}`}
            className={`font-sans text-meta font-medium px-3.5 h-full border-b-2 bg-transparent cursor-pointer tracking-fine transition-all duration-150 ${
              activeView === view.id
                ? 'text-text-primary border-b-text-primary'
                : 'text-text-muted border-b-transparent hover:text-text-secondary'
            }`}
            onClick={() => setActiveView(view.id)}
          >
            {view.label}
          </button>
        ))}
      </div>

      <LocaleSelect />
    </nav>
  )
}
