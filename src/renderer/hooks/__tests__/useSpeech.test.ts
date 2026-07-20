import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useSpeech } from '../useSpeech'

type UtteranceHandlers = {
  onstart: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => void) | null
  onend: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => void) | null
  onerror: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisErrorEvent) => void) | null
}

let lastUtterance: (SpeechSynthesisUtterance & UtteranceHandlers) | null
let speakMock: ReturnType<typeof vi.fn>
let cancelMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  lastUtterance = null
  speakMock = vi.fn((utterance: SpeechSynthesisUtterance) => {
    lastUtterance = utterance as SpeechSynthesisUtterance & UtteranceHandlers
  })
  cancelMock = vi.fn()

  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      speak: speakMock,
      cancel: cancelMock,
      getVoices: () => [],
      paused: false,
      pending: false,
      speaking: false,
    },
  })

  // jsdom may not provide SpeechSynthesisUtterance
  class MockUtterance {
    text: string
    lang = ''
    onstart: UtteranceHandlers['onstart'] = null
    onend: UtteranceHandlers['onend'] = null
    onerror: UtteranceHandlers['onerror'] = null

    constructor(text: string) {
      this.text = text
    }
  }

  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: MockUtterance,
  })
})

describe('useSpeech', () => {
  it('starts with speaking false', () => {
    const { result } = renderHook(() => useSpeech())
    expect(result.current.speaking).toBe(false)
  })

  it('cancels any ongoing speech before speaking', () => {
    const { result } = renderHook(() => useSpeech())

    act(() => {
      result.current.speak('churn')
    })

    expect(cancelMock).toHaveBeenCalledTimes(1)
    expect(speakMock).toHaveBeenCalledTimes(1)
  })

  it('sets utterance lang to en-US', () => {
    const { result } = renderHook(() => useSpeech())

    act(() => {
      result.current.speak('The churn rate dropped.')
    })

    expect(lastUtterance?.lang).toBe('en-US')
    expect(lastUtterance?.text).toBe('The churn rate dropped.')
  })

  it('sets speaking true on utterance start', () => {
    const { result } = renderHook(() => useSpeech())

    act(() => {
      result.current.speak('churn')
    })

    act(() => {
      lastUtterance?.onstart?.call(lastUtterance, {} as SpeechSynthesisEvent)
    })

    expect(result.current.speaking).toBe(true)
  })

  it('sets speaking false on utterance end', () => {
    const { result } = renderHook(() => useSpeech())

    act(() => {
      result.current.speak('churn')
    })
    act(() => {
      lastUtterance?.onstart?.call(lastUtterance, {} as SpeechSynthesisEvent)
    })
    act(() => {
      lastUtterance?.onend?.call(lastUtterance, {} as SpeechSynthesisEvent)
    })

    expect(result.current.speaking).toBe(false)
  })

  it('sets speaking false on utterance error', () => {
    const { result } = renderHook(() => useSpeech())

    act(() => {
      result.current.speak('churn')
    })
    act(() => {
      lastUtterance?.onstart?.call(lastUtterance, {} as SpeechSynthesisEvent)
    })
    act(() => {
      lastUtterance?.onerror?.call(lastUtterance, {} as SpeechSynthesisErrorEvent)
    })

    expect(result.current.speaking).toBe(false)
  })

  it('second speak cancels the previous utterance', () => {
    const { result } = renderHook(() => useSpeech())

    act(() => {
      result.current.speak('first')
    })
    act(() => {
      result.current.speak('second')
    })

    expect(cancelMock).toHaveBeenCalledTimes(2)
    expect(lastUtterance?.text).toBe('second')
  })

  it('stop cancels speech and clears speaking', () => {
    const { result } = renderHook(() => useSpeech())

    act(() => {
      result.current.speak('churn')
    })
    act(() => {
      lastUtterance?.onstart?.call(lastUtterance, {} as SpeechSynthesisEvent)
    })
    act(() => {
      result.current.stop()
    })

    expect(cancelMock).toHaveBeenCalled()
    expect(result.current.speaking).toBe(false)
  })

  it('isSpeaking is true only for the active text', () => {
    const { result } = renderHook(() => useSpeech())

    act(() => {
      result.current.speak('churn')
    })
    act(() => {
      lastUtterance?.onstart?.call(lastUtterance, {} as SpeechSynthesisEvent)
    })

    expect(result.current.isSpeaking('churn')).toBe(true)
    expect(result.current.isSpeaking('other')).toBe(false)
  })

  it('ignores onerror from a cancelled previous utterance', () => {
    const { result } = renderHook(() => useSpeech())

    act(() => {
      result.current.speak('first')
    })
    const first = lastUtterance

    act(() => {
      result.current.speak('second')
    })
    const second = lastUtterance

    act(() => {
      second?.onstart?.call(second, {} as SpeechSynthesisEvent)
    })
    act(() => {
      // Stale error from the cancelled first utterance
      first?.onerror?.call(first, {} as SpeechSynthesisErrorEvent)
    })

    expect(result.current.speaking).toBe(true)
    expect(result.current.isSpeaking('second')).toBe(true)
  })

  it('speak on active text stops playback', () => {
    const { result } = renderHook(() => useSpeech())

    act(() => {
      result.current.speak('churn')
    })
    act(() => {
      lastUtterance?.onstart?.call(lastUtterance, {} as SpeechSynthesisEvent)
    })
    act(() => {
      result.current.speak('churn')
    })

    expect(result.current.speaking).toBe(false)
    expect(cancelMock).toHaveBeenCalled()
  })
})
