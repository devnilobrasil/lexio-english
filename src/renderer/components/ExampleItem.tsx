// src/renderer/components/ExampleItem.tsx
import React from 'react'
import type { WordExample } from '../../types'

interface ExampleItemProps {
  example: WordExample
  word: string
}

export function ExampleItem({ example, word }: ExampleItemProps) {
  function highlightWord(text: string, target: string): string {
    const re = new RegExp(`\\b(${target}\\w*)\\b`, 'gi')
    return text.replace(re, '<strong>$1</strong>')
  }

  return (
    <div className="py-2.5 border-t border-border-muted first:border-t-0 first:pt-0">
      <p
        className="example-en font-sans text-example text-text-secondary leading-comfortable mb-1"
        dangerouslySetInnerHTML={{ __html: highlightWord(example.en, word) }}
      />
      <p className="font-sans text-meta text-text-muted leading-normal">
        {example.translation}
      </p>
    </div>
  )
}
