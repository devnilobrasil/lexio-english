// src/renderer/components/ExampleItem.tsx
import React from 'react'
import type { WordExample } from '../../types'

interface ExampleItemProps {
  example: WordExample
  word: string
  itemNumber: number
  showSeparator: boolean
  containerTestId?: string
  sentenceTestId?: string
}

export function ExampleItem({
  example,
  word,
  itemNumber,
  showSeparator,
  containerTestId,
  sentenceTestId,
}: ExampleItemProps) {
  function escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function highlightWord(text: string, target: string): React.ReactNode {
    const normalizedTarget = target.trim()
    if (!normalizedTarget) {
      return text
    }

    const escapedTarget = escapeRegExp(normalizedTarget)
    const re = new RegExp(`\\b(${escapedTarget}\\w*)\\b`, 'gi')
    const parts = text.split(re)

    if (parts.length === 1) {
      return text
    }

    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={`hl-${index}`}>{part}</strong>
      }
      return <React.Fragment key={`plain-${index}`}>{part}</React.Fragment>
    })
  }

  return (
    <div
      data-testid={containerTestId}
      className={`py-2.5 ${showSeparator ? 'border-t border-border-muted' : 'pt-1.5'}`}
    >
      <p
        data-testid={sentenceTestId}
        className="example-en font-sans text-example text-text-secondary leading-comfortable mb-1"
      >
        <span className="font-sans text-xs font-semibold text-text-primary mr-1.5">
          {itemNumber}.
        </span>
        {' '}
        {highlightWord(example.en, word)}
      </p>
      <p className="font-sans text-meta text-text-muted leading-normal">
        {example.translation}
      </p>
    </div>
  )
}
