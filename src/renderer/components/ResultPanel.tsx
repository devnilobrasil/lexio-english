// src/renderer/components/ResultPanel.tsx
import React from 'react'
import type { Word } from '../../types'
import { Sidebar } from './Sidebar'
import type { SidebarView } from './Sidebar'
import { ContentArea } from './ContentArea'

interface ResultPanelProps {
  activeView: SidebarView
  onSelectView: (view: SidebarView) => void
  word: Word | null
  loading: boolean
  error: string | null
  query: string
  savedWords: Word[]
  history: Word[]
  onToggleSaved: () => void
  onSelectWord: (word: string) => void
  onRemoveFromHistory: (word: string) => void
  onUnsaveWord: (word: string) => void
}

export function ResultPanel({
  activeView,
  onSelectView,
  word,
  loading,
  error,
  query,
  savedWords,
  history,
  onToggleSaved,
  onSelectWord,
  onRemoveFromHistory,
  onUnsaveWord,
}: ResultPanelProps) {
  return (
    <div className="result-panel">
      <Sidebar
        active={activeView}
        onSelect={onSelectView}
        hasWord={word !== null}
      />
      <ContentArea
        view={activeView}
        word={word}
        loading={loading}
        error={error}
        query={query}
        savedWords={savedWords}
        history={history}
        onToggleSaved={onToggleSaved}
        onSelectWord={onSelectWord}
        onRemoveFromHistory={onRemoveFromHistory}
        onUnsaveWord={onUnsaveWord}
      />
    </div>
  )
}
