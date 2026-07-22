import React from 'react'
import type { WordExample } from '../../types'
import type { TtsStatus } from '../tts/types'
import { SpeakButton } from './SpeakButton'

interface ExampleItemProps {
  example: WordExample
  word: string
  onSpeak: (text: string) => void
  isSpeaking: (text: string) => boolean
  status: TtsStatus
  testId?: string
}

export function ExampleItem({
  example,
  word,
  onSpeak,
  isSpeaking,
  status,
  testId,
}: ExampleItemProps) {
  function highlightWord(text: string, target: string): string {
    const re = new RegExp(`\\b(${target}\\w*)\\b`, 'gi')
    return text.replace(re, '<strong>$1</strong>')
  }

  return (
    <div className="py-2.5 border-t border-border-muted first:border-t-0 first:pt-0">
      <p className="example-en font-sans text-example text-text-secondary leading-comfortable mb-1">
        <span dangerouslySetInnerHTML={{ __html: highlightWord(example.en, word) }} />
        <SpeakButton
          onSpeak={() => onSpeak(example.en)}
          speaking={isSpeaking(example.en)}
          status={status}
          testId={testId}
          className="ml-1.5"
        />
      </p>
      <p className="font-sans text-meta text-text-muted leading-normal">
        {example.translation}
      </p>
    </div>
  )
}
