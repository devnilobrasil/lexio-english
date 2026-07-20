// src/renderer/components/ExampleItem.tsx
import React from 'react'
import type { WordExample } from '../../types'
import { SpeakButton } from './SpeakButton'

interface ExampleItemProps {
  example: WordExample
  word: string
  onSpeak: (text: string) => void
  isSpeaking: (text: string) => boolean
  testId?: string
}

export function ExampleItem({ example, word, onSpeak, isSpeaking, testId }: ExampleItemProps) {
  function highlightWord(text: string, target: string): string {
    const re = new RegExp(`\\b(${target}\\w*)\\b`, 'gi')
    return text.replace(re, '<strong>$1</strong>')
  }

  return (
    <div className="py-2.5 border-t border-border-muted first:border-t-0 first:pt-0">
      <div className="flex items-start gap-1.5 mb-1">
        <p
          className="example-en font-sans text-example text-text-secondary leading-comfortable flex-1"
          dangerouslySetInnerHTML={{ __html: highlightWord(example.en, word) }}
        />
        <SpeakButton
          onSpeak={() => onSpeak(example.en)}
          speaking={isSpeaking(example.en)}
          testId={testId}
        />
      </div>
      <p className="font-sans text-meta text-text-muted leading-normal">
        {example.translation}
      </p>
    </div>
  )
}
