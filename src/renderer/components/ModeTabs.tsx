import type { AppMode } from '../lib/appMode'

interface ModeTabsProps {
  mode: AppMode
  onChange: (mode: AppMode) => void
}

const TABS: Array<{ id: AppMode; label: string; testId: string }> = [
  { id: 'dictionary', label: 'Dicionário', testId: 'mode-tab-dictionary' },
  { id: 'translate', label: 'Traduzir', testId: 'mode-tab-translate' },
]

export function ModeTabs({ mode, onChange }: ModeTabsProps) {
  return (
    <div className="mode-tabs" role="tablist" aria-label="Modo Lexio" data-testid="mode-tabs">
      {TABS.map((tab) => {
        const selected = mode === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={tab.testId}
            className={`mode-tab${selected ? ' mode-tab--active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
