// src/renderer/components/DefinitionView.tsx
import React from 'react'
import { useTranslation } from 'react-i18next'
import type { Word } from '../../types'
import { SectionLabel } from './SectionLabel'

interface DefinitionViewProps {
  word: Word
  onToggleSaved: () => void
  onSelectSynonym: (synonym: string) => void
}

export function DefinitionView({ word, onToggleSaved, onSelectSynonym }: DefinitionViewProps) {
  const { t } = useTranslation()

  return (
    <div className="word-card-enter">
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
          className={`flex cursor-pointer items-center gap-1.5 font-sans text-xs font-medium px-3 py-1.5 border rounded-md transition-colors mt-1.5 ${
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

      {/* Meaning */}
      <div className="mb-5">
        <SectionLabel>{t('word.meaning')}</SectionLabel>
        <p className="font-serif text-meaning text-text-primary mb-2">
          {word.translation.meaning}
        </p>
        {word.meaning_en && (
          <p className="font-sans text-meta italic text-text-muted">
            {word.meaning_en}
          </p>
        )}
      </div>

      {/* Verb Forms */}
      {word.pos === 'verb' && word.verb_forms && (
        <div className="mb-5">
          <SectionLabel>{t('word.verbForms')}</SectionLabel>
          <div className="grid grid-cols-5 gap-x-3 gap-y-1">
            {(
              [
                ['verbInfinitive',        word.verb_forms.infinitive],
                ['verbPast',              word.verb_forms.past],
                ['verbPastParticiple',    word.verb_forms.past_participle],
                ['verbPresentParticiple', word.verb_forms.present_participle],
                ['verbThirdPerson',       word.verb_forms.third_person],
              ] as [string, string][]
            ).map(([key, value]) => (
              <div key={key} className="flex flex-col gap-0.5">
                <span className="font-sans text-label text-text-muted uppercase tracking-badge">
                  {t(`word.${key}`)}
                </span>
                <span className="font-serif text-meta text-text-secondary">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tip */}
      {word.translation.tip && (
        <div className="mb-1">
          <SectionLabel>{t('word.tip')}</SectionLabel>
          <p className="font-sans text-meta italic text-text-muted">
            {word.translation.tip}
          </p>
        </div>
      )}
    </div>
  )
}
