// src/renderer/components/AppShell.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { SearchBar } from './SearchBar'
import { ResultPanel } from './ResultPanel'
import { TitleBar } from './TitleBar'
import { TranslationPanel } from './TranslationPanel'
import { UpdateBanner } from './UpdateBanner'
import type { SidebarView } from './Sidebar'
import { useSearch } from '../hooks/useSearch'
import { useWindowControls } from '../hooks/useWindowControls'
import { useWords } from '../hooks/useWords'
import { useLocale } from '../hooks/useLocale'
import { useTranslationAssistant } from '../hooks/useTranslationAssistant'
import { useAppMode } from '../hooks/useAppMode'

type WindowState = 'idle' | 'result'

export function AppShell() {
  const [windowState, setWindowState] = useState<WindowState>('idle')
  const [activeView, setActiveView] = useState<SidebarView>('definition')
  const { word, loading, error, search, toggleSaved, query } = useSearch()
  const { savedWords, history, fetchSaved, fetchHistory, removeFromHistory, unsaveWord } = useWords()
  const { locale } = useLocale()
  const { resize } = useWindowControls()
  const translation = useTranslationAssistant()
  const { appMode, handleModeChange } = useAppMode(resize, windowState)
  const prevLocaleRef = useRef(locale)

  const transitionTo = useCallback((state: WindowState) => {
    setWindowState(state)
    if (appMode === 'dictionary') resize(state)
  }, [appMode, resize])

  useEffect(() => {
    if (word && !loading) setActiveView('definition')
  }, [word, loading])

  useEffect(() => {
    if (activeView === 'saved') fetchSaved()
    if (activeView === 'history') fetchHistory()
  }, [activeView, fetchSaved, fetchHistory])

  useEffect(() => {
    if (prevLocaleRef.current !== locale) {
      prevLocaleRef.current = locale
      if (query) search(query)
    }
  }, [locale]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback((term: string) => {
    if (windowState === 'idle') transitionTo('result')
    search(term)
  }, [windowState, transitionTo, search])

  const handleEscape = useCallback(() => {
    if (appMode === 'translate') {
      void translation.handleClose()
      return
    }
    if (windowState === 'result') transitionTo('idle')
  }, [appMode, translation, windowState, transitionTo])

  const handleSelectWord = useCallback((wordText: string) => {
    setActiveView('definition')
    search(wordText)
  }, [search])

  const handleToggleSaved = useCallback(async () => {
    await toggleSaved()
    if (activeView === 'saved') fetchSaved()
    if (activeView === 'history') fetchHistory()
  }, [toggleSaved, activeView, fetchSaved, fetchHistory])

  const handleToggleExpand = useCallback(() => {
    const next: WindowState = windowState === 'idle' ? 'result' : 'idle'
    setWindowState(next)
    resize(next)
  }, [windowState, resize])

  const showCopy = translation.state === 'ready' && Boolean(translation.translation)

  return (
    <div className="app-shell bg-surface-base">
      <TitleBar
        mode={appMode}
        onModeChange={handleModeChange}
        dictionaryExpanded={windowState === 'result'}
        onToggleExpand={handleToggleExpand}
        showCopy={showCopy}
        copied={translation.copied}
        onCopy={translation.handleCopy}
      />

      {appMode === 'dictionary' && (
        <>
          <SearchBar
            onSearch={handleSearch}
            onEscape={handleEscape}
            loading={loading}
          />
          {windowState === 'result' && (
            <ResultPanel
              activeView={activeView}
              onSelectView={setActiveView}
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
        </>
      )}

      {appMode === 'translate' && (
        <TranslationPanel
          state={translation.state}
          original={translation.original}
          translation={translation.translation}
          error={translation.error}
        />
      )}

      <UpdateBanner />
    </div>
  )
}
