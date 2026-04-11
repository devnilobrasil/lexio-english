// src/renderer/components/AppShell.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { SearchBar } from './SearchBar'
import { ResultPanel } from './ResultPanel'
import { UpdateBanner } from './UpdateBanner'
import type { SidebarView } from './Sidebar'
import { useSearch } from '../hooks/useSearch'
import { useWindowControls } from '../hooks/useWindowControls'
import { useWords } from '../hooks/useWords'
import { useLocale } from '../hooks/useLocale'

type WindowState = 'idle' | 'result'

export function AppShell() {
  const [windowState, setWindowState] = useState<WindowState>('idle')
  const [activeView, setActiveView] = useState<SidebarView>('definition')
  const { word, loading, error, search, toggleSaved, query } = useSearch()
  const { savedWords, history, fetchSaved, fetchHistory, removeFromHistory, unsaveWord } = useWords()
  const { locale } = useLocale()
  const { resize } = useWindowControls()
  const prevLocaleRef = useRef(locale)

  const transitionTo = useCallback((state: WindowState) => {
    setWindowState(state)
    resize(state)
  }, [resize])

  // When search returns a result, switch to definition view
  useEffect(() => {
    if (word && !loading) {
      setActiveView('definition')
    }
  }, [word, loading])

  // Fetch data when switching to saved/history views
  useEffect(() => {
    if (activeView === 'saved') fetchSaved()
    if (activeView === 'history') fetchHistory()
  }, [activeView, fetchSaved, fetchHistory])

  // Re-search when locale changes
  useEffect(() => {
    if (prevLocaleRef.current !== locale) {
      prevLocaleRef.current = locale
      if (query) search(query)
    }
  }, [locale]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback((term: string) => {
    if (windowState === 'idle') {
      transitionTo('result')
    }
    search(term)
  }, [windowState, transitionTo, search])

  const handleEscape = useCallback(() => {
    if (windowState === 'result') {
      transitionTo('idle')
    }
  }, [windowState, transitionTo])

  const handleSelectWord = useCallback((wordText: string) => {
    setActiveView('definition')
    search(wordText)
  }, [search])

  const handleToggleSaved = useCallback(async () => {
    await toggleSaved()
    if (activeView === 'saved') fetchSaved()
    if (activeView === 'history') fetchHistory()
  }, [toggleSaved, activeView, fetchSaved, fetchHistory])

  const handleSelectView = useCallback((view: SidebarView) => {
    setActiveView(view)
  }, [])

  const handleLogoClick = useCallback(() => {
    if (windowState === 'idle') {
      transitionTo('result')
    } else {
      transitionTo('idle')
    }
  }, [windowState, transitionTo])

  return (
    <div className={`app-shell ${windowState === 'result' ? 'bg-surface-base' : 'bg-surface-base/90'}`}>
      <SearchBar
        onSearch={handleSearch}
        onEscape={handleEscape}
        onLogoClick={handleLogoClick}
        loading={loading}
      />

      {windowState === 'result' && (
        <ResultPanel
          activeView={activeView}
          onSelectView={handleSelectView}
          word={word}
          loading={loading}
          error={error}
          query={query}
          savedWords={savedWords}
          history={history}
          onToggleSaved={handleToggleSaved}
          onSelectWord={handleSelectWord}
          onRemoveFromHistory={removeFromHistory}
          onUnsaveWord={unsaveWord}
        />
      )}

      <UpdateBanner />
    </div>
  )
}
