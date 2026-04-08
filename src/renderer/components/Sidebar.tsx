// src/renderer/components/Sidebar.tsx
import React, { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

export type SidebarView = 'definition' | 'examples' | 'synonyms' | 'saved' | 'history' | 'settings'

interface SidebarProps {
  active: SidebarView
  onSelect: (view: SidebarView) => void
  hasWord: boolean
}

const WORD_VIEWS: SidebarView[] = ['definition', 'examples', 'synonyms']
const NAV_VIEWS: SidebarView[] = [...WORD_VIEWS, 'saved', 'history']
const ALL_VIEWS: SidebarView[] = [...NAV_VIEWS, 'settings']

const ICONS: Record<SidebarView, React.ReactNode> = {
  definition: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
    </svg>
  ),
  examples: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/>
      <line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>
    </svg>
  ),
  synonyms: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
    </svg>
  ),
  saved: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  history: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  settings: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
}

export function Sidebar({ active, onSelect, hasWord }: SidebarProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return

    const idx = ALL_VIEWS.indexOf(active)
    if (idx === -1) return

    e.preventDefault()
    if (e.key === 'ArrowDown' && idx < ALL_VIEWS.length - 1) {
      onSelect(ALL_VIEWS[idx + 1])
    } else if (e.key === 'ArrowUp' && idx > 0) {
      onSelect(ALL_VIEWS[idx - 1])
    }
  }, [active, onSelect])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="sidebar" ref={containerRef} tabIndex={-1}>
      {NAV_VIEWS.map((view) => {
        const isWordView = WORD_VIEWS.includes(view)
        const disabled = isWordView && !hasWord

        return (
          <button
            key={view}
            className={`sidebar-item ${active === view ? 'active' : ''}`}
            onClick={() => onSelect(view)}
            disabled={disabled}
            style={disabled ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
            data-testid={`sidebar-${view}`}
          >
            {ICONS[view]}
            {t(`sidebar.${view}`)}
          </button>
        )
      })}

      {/* Spacer pushes settings to bottom */}
      <div className="flex-1" />

      <button
        className={`sidebar-item ${active === 'settings' ? 'active' : ''}`}
        onClick={() => onSelect('settings')}
        data-testid="sidebar-settings"
      >
        {ICONS.settings}
        {t('sidebar.settings')}
      </button>
    </div>
  )
}
