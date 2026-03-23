// src/renderer/components/HistoryList.tsx
import React from 'react'
import type { Word } from '../../types'

interface HistoryListProps {
  words: Word[]
  onSelect: (word: string) => void
}

export function HistoryList({ words, onSelect }: HistoryListProps) {
  if (words.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-700">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4 opacity-50">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <h3 className="text-lg font-bold text-gray-700">Histórico vazio</h3>
        <p className="text-gray-400 text-sm max-w-[250px] mt-1 leading-relaxed">
          As palavras que você pesquisar aparecerão aqui automaticamente.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">Buscas Recentes</h2>
      
      <div className="grid grid-cols-1 gap-3">
        {words.map((w) => (
          <div 
            key={w.word}
            className="group flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer"
            onClick={() => onSelect(w.word)}
          >
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <h4 className="font-bold text-gray-800">{w.word}</h4>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                  <span>Visto em {w.last_viewed ? new Date(w.last_viewed).toLocaleDateString() : 'hoje'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {w.is_saved === 1 && (
                <div className="w-2 h-2 rounded-full bg-blue-500" title="Salva" />
              )}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 group-hover:text-gray-500 transition-colors"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
