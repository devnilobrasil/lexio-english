// src/renderer/components/WordCard.tsx
import React from 'react'
import { useTranslation } from 'react-i18next'
import type { Word } from '../../types'
import { ExampleItem } from './ExampleItem'
import { SectionLabel } from './SectionLabel'
import { Divider } from './Divider'

interface WordCardProps {
  word: Word
  onToggleSaved: () => void
  onSelectSynonym?: (synonym: string) => void
}

export function WordCard({ word, onToggleSaved, onSelectSynonym }: WordCardProps) {
  const { t } = useTranslation()

  return (
    <div className="w-full max-w-2xl mx-auto word-card-enter">
      {/* Word Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h1 className="font-serif text-word-title font-semibold text-text-primary leading-none mb-2 tracking-title">
            {word.word}
          </h1>
          <div className="flex items-center gap-2.5">
            {word.phonetic && (
              <span className="font-serif text-example italic text-text-muted">
                /{word.phonetic}/
              </span>
            )}
            <div className="w-0.5 h-0.5 rounded-full bg-separator" />
            <span className="font-sans text-xs text-text-muted">
              {word.pos}
            </span>
            <div className="w-0.5 h-0.5 rounded-full bg-separator" />
            <span className="font-sans text-label font-medium tracking-badge uppercase bg-surface-sunken text-tag-text border border-border-subtle rounded-sm px-2 py-0.5">
              {word.level ? t(`level.${word.level}`) : word.level}
            </span>
          </div>
        </div>

        <button
          onClick={onToggleSaved}
          className={`flex items-center gap-1.5 font-sans text-xs font-medium px-3 py-1.5 border rounded-md transition-colors mt-1.5 ${
            word.is_saved
              ? 'bg-accent-bg border-accent-text/30 text-accent-text'
              : 'bg-transparent border-border-subtle text-text-muted hover:border-text-faint hover:text-text-secondary'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={word.is_saved ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3 h-3"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {word.is_saved ? t('word.saved') : t('word.save')}
        </button>
      </div>

      <Divider />

      {/* Meaning Block */}
      <div className="mb-5">
        <SectionLabel>{t('word.meaning')}</SectionLabel>
        <p className="font-serif text-meaning text-text-primary mb-2">
          {word.translation.meaning}
        </p>
      </div>

      {/* Examples */}
      {word.translation.examples.length > 0 && (
        <div className="mb-5">
          <SectionLabel>{t('word.examples')}</SectionLabel>
          <Divider />
          <div className="flex flex-col gap-2">
            {word.translation.examples.map((ex, i) => (
              <ExampleItem key={i} example={ex} word={word.word} />
            ))}
          </div>
        </div>
      )}

      {/* Tags Section (Synonyms and Contexts) */}
      <div className="flex gap-1.5 flex-wrap pt-5 border-t border-border-subtle">
        {word.synonyms.map((syn) => (
          <button
            key={syn}
            onClick={() => onSelectSynonym?.(syn)}
            className="font-sans text-xs font-normal text-tag-text bg-tag-bg hover:bg-surface-hover hover:text-text-secondary border-none rounded-sm px-2.5 py-1 cursor-pointer transition-colors"
          >
            {syn}
          </button>
        ))}
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
  )
}
