// src/renderer/components/SynonymsView.tsx
import React from 'react'
import { useTranslation } from 'react-i18next'
import type { Word } from '../../types'
import { SectionLabel } from './SectionLabel'

interface SynonymsViewProps {
  word: Word
  onSelect: (synonym: string) => void
}

export function SynonymsView({ word, onSelect }: SynonymsViewProps) {
  const { t } = useTranslation()
  const hasSynonyms = word.synonyms.length > 0
  const hasAntonyms = word.antonyms.length > 0
  const hasContexts = word.contexts.length > 0

  if (!hasSynonyms && !hasAntonyms && !hasContexts) {
    return (
      <div className="py-10 text-center">
        <p className="font-sans text-meta text-text-faint italic">
          {t('sidebar.synonyms')} — none available
        </p>
      </div>
    )
  }

  return (
    <div className="word-card-enter">
      {hasContexts && (
        <div className="mb-5">
          <SectionLabel>Contexts</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {word.contexts.map((ctx) => (
              <span
                key={ctx}
                className="font-sans text-xs font-medium text-accent-text bg-accent-bg rounded-sm px-2.5 py-1"
              >
                {ctx}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasAntonyms && (
        <div className="mb-5">
          <SectionLabel>{t('word.antonyms')}</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {word.antonyms.map((ant) => (
              <button
                key={ant}
                onClick={() => onSelect(ant)}
                className="font-sans text-xs font-normal text-status-error bg-surface-sunken hover:bg-surface-hover border-none rounded-sm px-2.5 py-1 cursor-pointer transition-colors"
              >
                {ant}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasSynonyms && (
        <div>
          <SectionLabel>{t('sidebar.synonyms')}</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {word.synonyms.map((syn) => (
              <button
                key={syn}
                onClick={() => onSelect(syn)}
                className="font-sans text-xs font-normal text-tag-text bg-tag-bg hover:bg-surface-hover hover:text-text-secondary border-none rounded-sm px-2.5 py-1 cursor-pointer transition-colors"
              >
                {syn}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
