// src/renderer/components/ExampleItem.tsx
import React from 'react'

interface Example {
  en: string
  pt: string
}

interface ExampleItemProps {
  example: Example
  word: string
}

export function ExampleItem({ example, word }: ExampleItemProps) {
  // util: highlight da palavra no exemplo
  function highlightWord(text: string, word: string): string {
    const re = new RegExp(`\\b(${word}\\w*)\\b`, 'gi')
    return text.replace(re, '<strong>$1</strong>')
  }

  return (
    <div className="py-[10px] border-t border-border-muted first:border-t-0 first:pt-0">
      <p
        className="font-sans text-[13px] text-text-secondary leading-[1.55] mb-[3px] [&>strong]:font-semibold [&>strong]:text-text-primary"
        dangerouslySetInnerHTML={{ __html: highlightWord(example.en, word) }}
      />
      <p className="font-sans text-[12px] text-text-muted leading-[1.5]">
        {example.pt}
      </p>
    </div>
  )
}
