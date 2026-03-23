// src/renderer/components/SavedWords.tsx
import React from 'react'
import type { Word } from '../../types'

interface SavedWordsProps {
  words: Word[]
  onSelect: (word: string) => void
  onRemove: (word: string) => void
}

export function SavedWords({ words, onSelect, onRemove }: SavedWordsProps) {
  if (words.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-700">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-400 mb-4 opacity-50">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
        </div>
        <h3 className="text-lg font-bold text-gray-700">Nenhuma palavra salva ainda</h3>
        <p className="text-gray-400 text-sm max-w-[250px] mt-1 leading-relaxed">
          As palavras que você marcar como favoritas aparecerão aqui para revisão rápida.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">Seu Vocabulário ({words.length})</h2>
      
      <div className="grid grid-cols-1 gap-3">
        {words.map((w) => (
          <div 
            key={w.word}
            className="group relative flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer"
            onClick={() => onSelect(w.word)}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                {w.word.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="font-bold text-gray-800">{w.word}</h4>
                <p className="text-xs text-gray-400 font-medium truncate max-w-[200px] sm:max-w-md">
                  {w.meaning_pt}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(w.word)
                }}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Remover"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
