// src/renderer/components/WordCard.tsx
import React from 'react'
import type { Word } from '../../types'
import { ExampleItem } from './ExampleItem'

interface WordCardProps {
  word: Word
  onToggleSaved: () => void
  onSelectSynonym?: (synonym: string) => void
}

export function WordCard({ word, onToggleSaved, onSelectSynonym }: WordCardProps) {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Cabeçalho do Card */}
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-bold tracking-tight text-gray-900">{word.word}</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100/50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
              {word.level}
            </span>
          </div>
          
          <div className="flex items-center gap-3 text-sm font-medium text-gray-500">
            {word.phonetic && (
              <span className="font-mono bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                /{word.phonetic}/
              </span>
            )}
            <span className="capitalize">{word.pos}</span>
          </div>
        </div>

        <button
          onClick={onToggleSaved}
          className={`group flex items-center justify-center w-12 h-12 rounded-2xl border transition-all duration-300 ${
            word.is_saved 
              ? 'bg-blue-600 border-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.3)]' 
              : 'bg-white border-gray-200 text-gray-400 hover:border-blue-400 hover:text-blue-500'
          }`}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill={word.is_saved ? "currentColor" : "none"} 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="w-5 h-5 group-active:scale-90 transition-transform"
          >
            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
          </svg>
        </button>
      </header>

      {/* Significados */}
      <section className="space-y-6">
        <div className="space-y-2 p-5 bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100/50 shadow-sm">
          <h3 className="text-sm font-bold text-blue-600 uppercase tracking-widest">Significado</h3>
          <p className="text-xl font-semibold text-gray-800 leading-snug">
            {word.meaning_pt}
          </p>
          {word.meaning_en && (
            <p className="text-gray-500 leading-relaxed">
              {word.meaning_en}
            </p>
          )}
        </div>

        {/* Contextos / Badges */}
        {word.contexts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {word.contexts.map(ctx => (
              <span 
                key={ctx}
                className="px-3 py-1 text-[11px] font-bold tracking-wide uppercase rounded-full bg-gray-100 text-gray-500 border border-gray-200"
              >
                {ctx}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Exemplos */}
      {word.examples.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            Exemplos Práticos
            <div className="flex-1 h-[1px] bg-gray-100" />
          </h3>
          <div className="space-y-3">
            {word.examples.map((ex, i) => (
              <ExampleItem key={i} example={ex} />
            ))}
          </div>
        </section>
      )}

      {/* Sinônimos */}
      {word.synonyms.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            Sinônimos
            <div className="flex-1 h-[1px] bg-gray-100" />
          </h3>
          <div className="flex flex-wrap gap-2">
            {word.synonyms.map(syn => (
              <button
                key={syn}
                onClick={() => onSelectSynonym?.(syn)}
                className="px-4 py-1.5 rounded-xl border border-gray-100 bg-white text-sm font-medium text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:shadow-sm transition-all"
              >
                {syn}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Metadados / Footer do Card */}
      <footer className="pt-8 flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-wider">
        <div className="flex gap-4">
          <span>Views: {word.view_count || 1}</span>
          {word.last_viewed && (
            <span>Última vez: {new Date(word.last_viewed).toLocaleDateString()}</span>
          )}
        </div>
      </footer>
    </div>
  )
}
