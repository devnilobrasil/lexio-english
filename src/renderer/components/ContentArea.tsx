// src/renderer/components/ContentArea.tsx
import React from 'react'
import type { Word } from '../../types'
import type { SidebarView } from './Sidebar'
import { DefinitionView } from './DefinitionView'
import { ExamplesView } from './ExamplesView'
import { SynonymsView } from './SynonymsView'
import { SavedWords } from './SavedWords'
import { HistoryList } from './HistoryList'

interface ContentAreaProps {
  view: SidebarView
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

export function ContentArea({
  view,
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
}: ContentAreaProps) {
  return (
    <div className="content-area">
      {loading && (
        <div className="flex flex-col items-start gap-4 py-2">
          <span className="font-serif text-word-title font-semibold text-separator tracking-title">
            &ldquo;{query}&rdquo;
          </span>
          <div className="flex gap-1.25">
            <span className="w-1.25 h-1.25 rounded-full bg-text-faint animate-pulse-dots" />
            <span className="w-1.25 h-1.25 rounded-full bg-text-faint animate-pulse-dots dot-delay-1" />
            <span className="w-1.25 h-1.25 rounded-full bg-text-faint animate-pulse-dots dot-delay-2" />
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="font-sans text-example text-status-error py-2">
          {error}
        </div>
      )}

      {!loading && !error && word && view === 'definition' && (
        <DefinitionView
          word={word}
          onToggleSaved={onToggleSaved}
          onSelectSynonym={onSelectWord}
        />
      )}

      {!loading && !error && word && view === 'examples' && (
        <ExamplesView word={word} />
      )}

      {!loading && !error && word && view === 'synonyms' && (
        <SynonymsView word={word} onSelect={onSelectWord} />
      )}

      {view === 'saved' && (
        <SavedWords
          words={savedWords}
          onSelect={onSelectWord}
          onRemove={onUnsaveWord}
        />
      )}

      {view === 'history' && (
        <HistoryList
          words={history}
          onSelect={onSelectWord}
          onRemove={onRemoveFromHistory}
        />
      )}
    </div>
  )
}
