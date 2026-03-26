// src/renderer/App.tsx
import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TitleBar } from './components/TitleBar'
import { SearchBar } from './components/SearchBar'
import { WordCard } from './components/WordCard'
import { SavedWords } from './components/SavedWords'
import { HistoryList } from './components/HistoryList'
import { Nav } from './components/Nav'
import { StatusBar } from './components/StatusBar'
import { SectionLabel } from './components/SectionLabel'
import { useSearch } from './hooks/useSearch'
import { useWords } from './hooks/useWords'
import { useLocale } from './hooks/useLocale'

type View = 'search' | 'saved' | 'history'

export default function App() {
  const [activeTab, setActiveTab] = useState<View>('search')
  const { word, loading, error, search, toggleSaved, query } = useSearch()
  const { savedWords, history, fetchSaved, fetchHistory, removeFromHistory, unsaveWord } = useWords()
  const { t } = useTranslation()
  const { locale } = useLocale()
  const prevLocaleRef = useRef(locale)

  useEffect(() => {
    if (activeTab === 'saved') fetchSaved()
    if (activeTab === 'history' || activeTab === 'search') fetchHistory()
  }, [activeTab, fetchSaved, fetchHistory])

  useEffect(() => {
    if (prevLocaleRef.current !== locale) {
      prevLocaleRef.current = locale
      if (query) search(query)
    }
  }, [locale]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectWord = async (wordText: string) => {
    setActiveTab('search')
    search(wordText)
  }

  const handleToggleSaved = async () => {
    await toggleSaved()
    if (activeTab === 'saved') fetchSaved()
    if (activeTab === 'history') fetchHistory()
  }

  return (
    <div className="app-window rounded-xl border border-border-subtle">
      <TitleBar />
      <Nav activeView={activeTab} setActiveView={setActiveTab} />

      <main className="app-body">
        {activeTab === 'search' && (
          <>
            <SearchBar onSearch={search} loading={loading} />

            {loading && (
              <div className="flex flex-col items-start gap-4 py-2">
                <span className="font-serif text-word-title font-semibold text-separator tracking-title">
                  "{query}"
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

            {word && !loading && !error && (
              <WordCard
                word={word}
                onToggleSaved={handleToggleSaved}
                onSelectSynonym={search}
              />
            )}

            {!word && !loading && !error && (
              <div className="py-2 text-text-faint">
                <SectionLabel className="mb-3">{t('search.recent')}</SectionLabel>
                <div className="flex flex-wrap gap-x-2 gap-y-2">
                  {history.slice(0, 5).map((h) => (
                    <button
                      key={h.id}
                      onClick={() => handleSelectWord(h.word)}
                      className="font-serif text-sm text-text-muted bg-surface-sunken border border-border-subtle rounded-md px-3 py-1 cursor-pointer transition-colors hover:text-text-secondary hover:border-text-faint"
                    >
                      {h.word}
                    </button>
                  ))}
                  {history.length === 0 && (
                    <p className="text-sm w-full text-center italic">{t('search.empty')}</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'saved' && (
          <div className="max-w-2xl mx-auto w-full">
            <SavedWords
              words={savedWords}
              onSelect={handleSelectWord}
              onRemove={unsaveWord}
            />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-2xl mx-auto w-full">
            <HistoryList
              words={history}
              onSelect={handleSelectWord}
              onRemove={removeFromHistory}
            />
          </div>
        )}
      </main>

      <StatusBar version="1.0.0" />
    </div>
  )
}
