import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DefinitionView } from '../DefinitionView'
import { ExamplesView } from '../ExamplesView'
import type { Word } from '../../../types'
import type { SpeechController } from '../../hooks/useSpeech'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

const word: Word = {
  word: 'churn',
  phonetic: '/tʃɜːrn/',
  pos: 'noun',
  level: 'Intermediate',
  verb_forms: null,
  meanings: [
    {
      context: 'business',
      meaning_en: 'The rate at which customers stop using a service',
      meaning_short: 'taxa de cancelamento',
      meaning: 'Dica em português sobre churn',
      examples: [
        {
          en: 'The churn rate dropped last quarter.',
          translation: 'A taxa de churn caiu no último trimestre.',
        },
      ],
    },
  ],
  synonyms: [],
  antonyms: [],
  contexts: ['business'],
}

function createSpeechMock(): SpeechController & { speak: ReturnType<typeof vi.fn> } {
  return {
    speak: vi.fn(),
    stop: vi.fn(),
    speaking: false,
    isSpeaking: vi.fn(() => false),
    status: 'ready',
  }
}

describe('TTS English-only integration', () => {
  let speech: ReturnType<typeof createSpeechMock>

  beforeEach(() => {
    speech = createSpeechMock()
  })

  it('speaks word.word and meaning_en from DefinitionView, never PT tip text', async () => {
    const user = userEvent.setup()

    render(
      <DefinitionView
        word={word}
        onToggleSaved={vi.fn()}
        onSelectSynonym={vi.fn()}
        speech={speech}
      />,
    )

    await user.click(screen.getByTestId('speak-word'))
    await user.click(screen.getByTestId('speak-meaning-0'))

    expect(speech.speak).toHaveBeenCalledWith('churn')
    expect(speech.speak).toHaveBeenCalledWith(
      'The rate at which customers stop using a service',
    )
    expect(speech.speak).not.toHaveBeenCalledWith('taxa de cancelamento')
    expect(speech.speak).not.toHaveBeenCalledWith('Dica em português sobre churn')
  })

  it('speaks example.en from ExamplesView, never translation', async () => {
    const user = userEvent.setup()

    render(<ExamplesView word={word} speech={speech} />)

    await user.click(screen.getByTestId('speak-example-0'))

    expect(speech.speak).toHaveBeenCalledWith('The churn rate dropped last quarter.')
    expect(speech.speak).not.toHaveBeenCalledWith(
      'A taxa de churn caiu no último trimestre.',
    )
  })
})
