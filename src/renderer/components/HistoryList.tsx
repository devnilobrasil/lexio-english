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
        <p className="font-sans text-[12px] font-medium tracking-[1px] uppercase text-text-faint mb-3">Histórico vazio</p>
        <p className="font-serif text-sm text-text-muted italic max-w-[250px]">
          As palavras que você pesquisar aparecerão aqui automaticamente.
        </p>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in duration-500">
      <p className="section-label px-1">Buscas Recentes</p>
      
      <div className="flex flex-col border-t border-border-subtle">
        {words.map((w) => (
          <div 
            key={w.word}
            className="group flex items-center justify-between py-4 border-b border-border-muted cursor-pointer transition-colors hover:bg-surface-hover px-2 rounded-sm"
            onClick={() => onSelect(w.word)}
          >
            <div className="flex flex-col gap-1">
              <h4 className="font-serif text-lg font-semibold text-text-primary leading-tight">{w.word}</h4>
              <div className="flex items-center gap-[6px]">
                <span className="font-sans text-[10px] text-text-faint tracking-[0.5px] uppercase">
                  Visto em {w.last_viewed ? new Date(w.last_viewed).toLocaleDateString() : 'hoje'}
                </span>
                {w.is_saved === 1 && (
                  <div className="w-[6px] h-[6px] rounded-full bg-accent-text" title="Salva" />
                )}
              </div>
            </div>

            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-faint group-hover:text-text-muted transition-colors"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        ))}
      </div>
    </div>
  )
}
