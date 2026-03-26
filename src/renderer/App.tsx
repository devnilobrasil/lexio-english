// src/renderer/App.tsx
import React, { useState, useEffect } from 'react'
import { TitleBar } from './components/TitleBar'
import { SearchBar } from './components/SearchBar'
import { WordCard } from './components/WordCard'
import { SavedWords } from './components/SavedWords'
import { HistoryList } from './components/HistoryList'
import { Nav } from './components/Nav'
import { StatusBar } from './components/StatusBar'
import { useSearch } from './hooks/useSearch'
import { useWords } from './hooks/useWords'

type View = 'search' | 'saved' | 'history'

export default function App() {
  const [activeTab, setActiveTab] = useState<View>('search')
  const { word, loading, error, search, toggleSaved, query } = useSearch()
  const { savedWords, history, fetchSaved, fetchHistory, deleteWord, loading: wordsLoading } = useWords()

  // Sincroniza dados ao mudar de aba
  useEffect(() => {
    if (activeTab === 'saved') fetchSaved()
    if (activeTab === 'history' || activeTab === 'search') fetchHistory()
  }, [activeTab, fetchSaved, fetchHistory])

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
                <span className="font-serif text-[42px] font-semibold text-[#D3D1C7] tracking-[-0.5px]">
                  "{query}"
                </span>
                <div className="flex gap-[5px]">
                  <span className="w-[5px] h-[5px] rounded-full bg-text-faint animate-pulse-dots" />
                  <span className="w-[5px] h-[5px] rounded-full bg-text-faint animate-pulse-dots [animation-delay:0.2s]" />
                  <span className="w-[5px] h-[5px] rounded-full bg-text-faint animate-pulse-dots [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="font-sans text-[13px] text-[#D85A30] py-2">
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
                <p className="font-sans text-xs font-medium tracking-[1px] uppercase mb-3">Histórico recente</p>
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
                    <p className="text-sm w-full text-center italic">Sua busca aparecerá aqui.</p>
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
              onRemove={deleteWord} 
            />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-2xl mx-auto w-full">
            <HistoryList 
              words={history} 
              onSelect={handleSelectWord} 
            />
          </div>
        )}
      </main>

      <StatusBar version="1.0.0" />
    </div>
  )
}
