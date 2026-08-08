import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExamplesView } from '../ExamplesView'
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

describe('ExamplesView', () => {
  it('normalizes mixed-case contexts into the same category', () => {
    const word: Word = {
      ...baseWord,
      meanings: [
        {
          context: 'Noun (countable)',
          meaning_en: 'A feline',
          meaning_short: 'A feline',
          meaning: 'A feline',
          examples: [{ en: 'A first noun example.', translation: 'Um primeiro exemplo substantivo.' }],
        },
        {
          context: ' noun ',
          meaning_en: 'Another noun meaning',
          meaning_short: 'Another noun meaning',
          meaning: 'Another noun meaning',
          examples: [{ en: 'A second noun example.', translation: 'Um segundo exemplo substantivo.' }],
        },
      ],
    }

    render(<ExamplesView word={word} />)

    expect(screen.getAllByText('noun')).toHaveLength(1)
    expect(screen.getByTestId('example-en-0-0')).toHaveTextContent('1. A first noun example.')
    expect(screen.getByTestId('example-en-0-1')).toHaveTextContent('2. A second noun example.')
  })

  it('falls back to word.pos when context is empty', () => {
    const word: Word = {
      ...baseWord,
      pos: 'verb',
      meanings: [
        {
          context: '   ',
          meaning_en: 'Meaning',
          meaning_short: 'Meaning',
          meaning: 'Meaning',
          examples: [{ en: 'Fallback verb example.', translation: 'Exemplo de fallback verbo.' }],
        },
      ],
    }

    render(<ExamplesView word={word} />)

    expect(screen.getByText('verb')).toBeInTheDocument()
    expect(screen.getByTestId('example-en-0-0')).toHaveTextContent('1. Fallback verb example.')
  })

  it("falls back to 'other' when both context and word.pos are missing", () => {
    const word: Word = {
      ...baseWord,
      pos: null,
      meanings: [
        {
          context: ' ',
          meaning_en: 'Meaning',
          meaning_short: 'Meaning',
          meaning: 'Meaning',
          examples: [{ en: 'Fallback other example.', translation: 'Exemplo de fallback outro.' }],
        },
      ],
    }

    render(<ExamplesView word={word} />)

    expect(screen.getByText('other')).toBeInTheDocument()
    expect(screen.getByTestId('example-en-0-0')).toHaveTextContent('1. Fallback other example.')
  })

  it('orders category groups deterministically', () => {
    const word: Word = {
      ...baseWord,
      meanings: [
        {
          context: 'verb',
          meaning_en: 'Meaning 1',
          meaning_short: 'Meaning 1',
          meaning: 'Meaning 1',
          examples: [{ en: 'Verb category example.', translation: 'Exemplo da categoria verbo.' }],
        },
        {
          context: 'Noun',
          meaning_en: 'Meaning 2',
          meaning_short: 'Meaning 2',
          meaning: 'Meaning 2',
          examples: [{ en: 'Noun category example.', translation: 'Exemplo da categoria substantivo.' }],
        },
      ],
    }

    render(<ExamplesView word={word} />)

    expect(screen.getByTestId('example-en-0-0')).toHaveTextContent('1. Noun category example.')
    expect(screen.getByTestId('example-en-1-0')).toHaveTextContent('1. Verb category example.')
  })

  it('groups examples by derived part of speech and resets numbering per group', () => {
    const word: Word = {
      ...baseWord,
      meanings: [
        {
          context: 'noun (countable)',
          meaning_en: 'A feline',
          meaning_short: 'A feline',
          meaning: 'A feline',
          examples: [{ en: 'The cat is sleeping.', translation: 'O gato está dormindo.' }],
        },
        {
          context: 'verb',
          meaning_en: 'To hoist an anchor',
          meaning_short: 'To hoist an anchor',
          meaning: 'To hoist an anchor',
          examples: [{ en: 'They cat the anchor quickly.', translation: 'Eles içam a âncora rapidamente.' }],
        },
        {
          context: 'noun',
          meaning_en: 'Another noun meaning',
          meaning_short: 'Another noun meaning',
          meaning: 'Another noun meaning',
          examples: [{ en: 'The black cat crossed the street.', translation: 'O gato preto atravessou a rua.' }],
        },
      ],
    }

    render(<ExamplesView word={word} />)

    expect(screen.getAllByText('noun')).toHaveLength(1)
    expect(screen.getAllByText('verb')).toHaveLength(1)

    expect(screen.getByTestId('example-en-0-0')).toHaveTextContent('1. The cat is sleeping.')
    expect(screen.getByTestId('example-en-0-1')).toHaveTextContent('2. The black cat crossed the street.')
    expect(screen.getByTestId('example-en-1-0')).toHaveTextContent('1. They cat the anchor quickly.')

    expect(screen.getByText('O gato está dormindo.')).toBeInTheDocument()
    expect(screen.getByText('O gato preto atravessou a rua.')).toBeInTheDocument()
    expect(screen.getByText('Eles içam a âncora rapidamente.')).toBeInTheDocument()
  })

  it('adds separators only between examples of the same category', () => {
    const word: Word = {
      ...baseWord,
      meanings: [
        {
          context: 'noun',
          meaning_en: 'Meaning 1',
          meaning_short: 'Meaning 1',
          meaning: 'Meaning 1',
          examples: [
            { en: 'First noun example.', translation: 'Primeiro exemplo substantivo.' },
            { en: 'Second noun example.', translation: 'Segundo exemplo substantivo.' },
          ],
        },
        {
          context: 'verb',
          meaning_en: 'Meaning 2',
          meaning_short: 'Meaning 2',
          meaning: 'Meaning 2',
          examples: [{ en: 'Verb example.', translation: 'Exemplo verbo.' }],
        },
      ],
    }

    render(<ExamplesView word={word} />)

    expect(screen.getByTestId('example-item-0-0')).not.toHaveClass('border-t')
    expect(screen.getByTestId('example-item-0-1')).toHaveClass('border-t')
    expect(screen.getByTestId('example-item-1-0')).not.toHaveClass('border-t')
  })
})
