// src/renderer/components/SavedWords.tsx
import React from 'react'
import { useTranslation } from 'react-i18next'
import type { Word } from '../../types'
import { SectionLabel } from './SectionLabel'

interface SavedWordsProps {
  words: Word[]
  onSelect: (word: string) => void
  onRemove: (word: string) => void
}

export function SavedWords({ words, onSelect, onRemove }: SavedWordsProps) {
  const { t } = useTranslation()

  if (words.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-700">
        <p className="font-sans text-meta font-medium tracking-label uppercase text-text-faint mb-3">{t('saved.empty_title')}</p>
        <p className="font-serif text-sm text-text-muted italic max-w-64">
          {t('saved.empty_desc')}
        </p>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in duration-500">
      <SectionLabel className="px-1">{t('saved.title', { count: words.length })}</SectionLabel>

      <div className="flex flex-col border-t border-border-subtle">
        {words.map((w) => (
          <div
            key={w.word}
            className="group flex items-center justify-between py-4 border-b border-border-muted cursor-pointer transition-colors hover:bg-surface-hover px-2 rounded-sm"
            onClick={() => onSelect(w.word)}
          >
            <div className="flex flex-col gap-1">
              <h4 className="font-serif text-lg font-semibold text-text-primary leading-tight">{w.word}</h4>
              <p className="font-sans text-meta text-text-muted truncate max-w-75">
                {w.translation.meaning}
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove(w.word)
              }}
              className="w-8 h-8 flex items-center justify-center rounded-md bg-surface-sunken text-text-faint hover:bg-surface-hover hover:text-status-error transition-colors cursor-pointer"
              title="Remover"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
