import React, { useState, useEffect } from 'react'
import { TitleBar } from './components/TitleBar'
import { SearchBar } from './components/SearchBar'
import { WordCard } from './components/WordCard'
import { SavedWords } from './components/SavedWords'
import { HistoryList } from './components/HistoryList'
import { useSearch } from './hooks/useSearch'
import { useWords } from './hooks/useWords'

export default function App() {
  const [activeTab, setActiveTab] = useState<'search' | 'saved' | 'history'>('search')
  const { word, loading, error, search, toggleSaved, setWord } = useSearch()
  const { savedWords, history, fetchSaved, fetchHistory, deleteWord } = useWords()

  // Sincroniza dados ao mudar de aba
  useEffect(() => {
    if (activeTab === 'saved') fetchSaved()
    if (activeTab === 'history') fetchHistory()
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
    <div className="h-screen flex flex-col overflow-hidden bg-white/95 rounded-xl border border-gray-200 shadow-2xl backdrop-blur-md">
      <TitleBar />
      
      {/* Navegação */}
      <nav className="flex items-center gap-6 px-6 py-4 border-b border-gray-100 shrink-0">
        <button 
          onClick={() => setActiveTab('search')}
          className={`text-sm font-medium transition-colors ${activeTab === 'search' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Busca
        </button>
        <button 
          onClick={() => setActiveTab('saved')}
          className={`text-sm font-medium transition-colors ${activeTab === 'saved' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Salvos
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`text-sm font-medium transition-colors ${activeTab === 'history' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Histórico
        </button>
      </nav>

      {/* Conteúdo Principal */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'search' && (
          <div className="p-6 space-y-10 min-h-full flex flex-col">
            <div className={`transition-all duration-500 ${word ? 'mt-4' : 'mt-[15vh]'}`}>
              <SearchBar onSearch={search} loading={loading} />
            </div>

            {error && (
              <div className="max-w-2xl mx-auto w-full p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                {error}
              </div>
            )}

            {word && !loading && (
              <WordCard 
                word={word} 
                onToggleSaved={handleToggleSaved} 
                onSelectSynonym={search}
              />
            )}

            {!word && !loading && !error && (
              <div className="flex flex-col items-center justify-center flex-1 text-center space-y-4 animate-in fade-in duration-700">
                <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-500 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Pronto para aprender?</h1>
                <p className="text-gray-500 max-w-xs text-sm leading-relaxed">
                  Busque qualquer palavra em inglês para ver seu significado, fonética e exemplos práticos.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="p-6 max-w-2xl mx-auto w-full">
            <SavedWords 
              words={savedWords} 
              onSelect={handleSelectWord} 
              onRemove={deleteWord} 
            />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-6 max-w-2xl mx-auto w-full">
            <HistoryList 
              words={history} 
              onSelect={handleSelectWord} 
            />
          </div>
        )}
      </main>

      {/* Footer / Status */}
      <footer className="px-6 py-2 border-t border-gray-50 bg-gray-50/50 flex justify-between items-center shrink-0">
        <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Lexio v1.0.0</span>
        <div className="flex gap-2 items-center">
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">Status</span>
          <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]'}`} />
        </div>
      </footer>
    </div>
  )
}


