import React from 'react'
import { useTranslation } from 'react-i18next'
import type { Word } from '../../types'
import type { SpeechController } from '../hooks/useSpeech'
import { ExampleItem } from './ExampleItem'
import { SectionLabel } from './SectionLabel'

interface ExamplesViewProps {
  word: Word
  speech: SpeechController
}

export function ExamplesView({ word, speech }: ExamplesViewProps) {
  const { t } = useTranslation()
  const { speak, isSpeaking, status } = speech
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
          <ExampleItem
            key={i}
            example={ex}
            word={word.word}
            onSpeak={speak}
            isSpeaking={isSpeaking}
            status={status}
            testId={`speak-example-${i}`}
          />
        ))}
      </div>
    </div>
  )
}
