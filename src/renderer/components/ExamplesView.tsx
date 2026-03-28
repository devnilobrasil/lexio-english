// src/renderer/components/ExamplesView.tsx
import React from 'react'
import { useTranslation } from 'react-i18next'
import type { Word } from '../../types'
import { ExampleItem } from './ExampleItem'
import { SectionLabel } from './SectionLabel'

interface ExamplesViewProps {
  word: Word
}

export function ExamplesView({ word }: ExamplesViewProps) {
  const { t } = useTranslation()
  const allExamples = word.meanings.flatMap(m => m.examples)

  if (allExamples.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="font-sans text-meta text-text-faint italic">
          {t('word.examples')} — none available
        </p>
      </div>
    )
  }

  return (
    <div className="word-card-enter">
      <SectionLabel>{t('word.examples')}</SectionLabel>
      <div className="flex flex-col gap-1">
        {allExamples.map((ex, i) => (
          <ExampleItem key={i} example={ex} word={word.word} />
        ))}
      </div>
    </div>
  )
}
