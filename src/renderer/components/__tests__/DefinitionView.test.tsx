import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DefinitionView } from '../DefinitionView'
import type { Word } from '../../../types'

const baseWord: Word = {
  word: 'cat',
  phonetic: '/kæt/',
  pos: 'noun',
  level: null,
  verb_forms: null,
  meanings: [],
  synonyms: [],
  antonyms: [],
  contexts: [],
  is_saved: 0,
}

describe('DefinitionView', () => {
  it('groups meanings by part of speech using tags', () => {
    const word: Word = {
      ...baseWord,
      meanings: [
        { context: 'noun (countable)', meaning_en: 'A feline.', meaning_short: 'A feline.', meaning: 'A feline.', examples: [] },
        { context: 'verb', meaning_en: 'To hoist an anchor.', meaning_short: 'To hoist an anchor.', meaning: 'To hoist an anchor.', examples: [] },
      ],
    }

    render(<DefinitionView word={word} onToggleSaved={() => {}} onSelectSynonym={vi.fn()} />)

    expect(screen.getAllByText('noun').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('verb')).toBeInTheDocument()
  })

  it('numbers definitions inside each part of speech group', () => {
    const word: Word = {
      ...baseWord,
      meanings: [
        { context: 'noun', meaning_en: 'First meaning.', meaning_short: 'First meaning.', meaning: 'First meaning.', examples: [] },
        { context: 'noun', meaning_en: 'Second meaning.', meaning_short: 'Second meaning.', meaning: 'Second meaning.', examples: [] },
      ],
    }

    render(<DefinitionView word={word} onToggleSaved={() => {}} onSelectSynonym={vi.fn()} />)

    expect(screen.getByTestId('meaning-short-0-0')).toHaveTextContent('1. First meaning.')
    expect(screen.getByTestId('meaning-short-0-1')).toHaveTextContent('2. Second meaning.')
  })

  it('applies updated typography and separator classes to definitions', () => {
    const word: Word = {
      ...baseWord,
      meanings: [
        { context: 'noun', meaning_en: 'First meaning.', meaning_short: 'First meaning.', meaning: 'First meaning.', examples: [] },
        { context: 'noun', meaning_en: 'Second meaning.', meaning_short: 'Second meaning.', meaning: 'Second meaning.', examples: [] },
      ],
    }

    render(<DefinitionView word={word} onToggleSaved={() => {}} onSelectSynonym={vi.fn()} />)

    const firstLine = screen.getByTestId('meaning-short-0-0')
    expect(firstLine).toHaveClass('font-sans')
    expect(firstLine).toHaveClass('text-example')

    const numberElement = firstLine.querySelector('span')
    expect(numberElement).not.toBeNull()
    expect(numberElement).toHaveClass('text-xs')

    const secondLine = screen.getByTestId('meaning-short-0-1')
    const secondItemContainer = secondLine.parentElement
    expect(secondItemContainer).not.toBeNull()
    expect(secondItemContainer).toHaveClass('border-t')
    expect(secondItemContainer).toHaveClass('border-border-muted')
    expect(secondItemContainer).not.toHaveClass('first:border-t-0')
  })
})
