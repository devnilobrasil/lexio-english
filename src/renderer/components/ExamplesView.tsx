// src/renderer/components/ExamplesView.tsx
import React from 'react'
import { useTranslation } from 'react-i18next'
import type { Word } from '../../types'
import { ExampleItem } from './ExampleItem'
import { SectionLabel } from './SectionLabel'

interface ExamplesViewProps {
  word: Word
}

function normalizeCategoryKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function getPartOfSpeechFromContext(context: string, fallbackPos: Word['pos']) {
  const normalizedContext = context.trim()
  if (normalizedContext) {
    const [head] = normalizedContext.split('(')
    const normalizedPartOfSpeech = normalizeCategoryKey(head)
    if (normalizedPartOfSpeech) {
      return normalizedPartOfSpeech
    }
  }

  return normalizeCategoryKey(fallbackPos) || 'other'
}

export function ExamplesView({ word }: ExamplesViewProps) {
  const { t } = useTranslation()
  const groupedExamples = word.meanings.reduce<
    Map<string, Array<{ example: (typeof word.meanings)[number]['examples'][number] }>>
  >((groups, meaning) => {
    const partOfSpeech = getPartOfSpeechFromContext(meaning.context, word.pos)
    const existingGroup = groups.get(partOfSpeech) ?? []
    meaning.examples.forEach((example) => {
      existingGroup.push({ example })
    })
    groups.set(partOfSpeech, existingGroup)
    return groups
  }, new Map())
  const orderedGroupedExamples = Array.from(groupedExamples.entries()).sort(([left], [right]) => {
    return left.localeCompare(right)
  })

  const allExamplesCount = orderedGroupedExamples.reduce((count, [, examples]) => {
    return count + examples.length
  }, 0)

  if (allExamplesCount === 0) {
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
      {orderedGroupedExamples.map(([partOfSpeech, examples], groupIndex) => {
        return (
          <div key={partOfSpeech} className={groupIndex > 0 ? 'mt-4' : ''}>
            <div className="mt-1.5 mb-2">
              <span className="font-sans text-label font-medium tracking-badge uppercase bg-surface-sunken text-tag-text border border-border-subtle rounded-sm px-2 py-0.5">
                {partOfSpeech}
              </span>
            </div>

            {examples.map(({ example }, exampleIndex) => {
              return (
                <ExampleItem
                  key={`${partOfSpeech}-${exampleIndex}`}
                  example={example}
                  word={word.word}
                  itemNumber={exampleIndex + 1}
                  showSeparator={exampleIndex > 0}
                  containerTestId={`example-item-${groupIndex}-${exampleIndex}`}
                  sentenceTestId={`example-en-${groupIndex}-${exampleIndex}`}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
