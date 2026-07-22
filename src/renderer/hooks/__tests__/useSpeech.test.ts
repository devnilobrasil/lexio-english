import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSpeech } from '../useSpeech'
import type { KokoroClient } from '../../tts/kokoroClient'
import type { AudioPlayer } from '../../tts/audioPlayer'
import type { PcmAudio, TtsStatus } from '../../tts/types'

vi.mock('../../tts/kokoroClient', () => ({
  createKokoroClient: vi.fn(),
}))

vi.mock('../../tts/audioPlayer', () => ({
  createAudioPlayer: vi.fn(),
}))

import { createKokoroClient } from '../../tts/kokoroClient'
import { createAudioPlayer } from '../../tts/audioPlayer'

function createMocks() {
  let status: TtsStatus = 'loading'
  let resolveInit: (() => void) | null = null
  let rejectInit: ((error: Error) => void) | null = null
  let resolveSpeak: ((audio: PcmAudio) => void) | null = null
  let rejectSpeak: ((error: Error) => void) | null = null

  let playerOnEnded: (() => void) | undefined

  const client: KokoroClient = {
    initialize: vi.fn(() => new Promise<void>((resolve, reject) => {
      resolveInit = resolve
      rejectInit = reject
    })),
    speak: vi.fn(() => new Promise<PcmAudio>((resolve, reject) => {
      resolveSpeak = resolve
      rejectSpeak = reject
    })),
    stop: vi.fn(() => {
      rejectSpeak?.(new Error('Cancelled'))
      resolveSpeak = null
      rejectSpeak = null
    }),
    getStatus: vi.fn(() => status),
    dispose: vi.fn(),
  }

  const player: AudioPlayer = {
    play: vi.fn(async (_pcm, _rate, onEnded) => {
      playerOnEnded = onEnded
    }),
    stop: vi.fn(),
  }

  vi.mocked(createKokoroClient).mockReturnValue(client)
  vi.mocked(createAudioPlayer).mockReturnValue(player)

  return {
    client,
    player,
    markReady: () => {
      status = 'ready'
      resolveInit?.()
    },
    markError: (message: string) => {
      status = 'error'
      rejectInit?.(new Error(message))
    },
    resolveAudio: (pcm = new Float32Array([0.1, 0.2]), sampleRate = 24000) => {
      resolveSpeak?.({ pcm, sampleRate })
      resolveSpeak = null
      rejectSpeak = null
    },
    finishPlayback: () => {
      playerOnEnded?.()
    },
  }
}

describe('useSpeech (Kokoro)', () => {
  let mocks: ReturnType<typeof createMocks>

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMocks()
  })

  it('starts loading and becomes ready after preload', async () => {
    const { result } = renderHook(() => useSpeech())

    expect(result.current.status).toBe('loading')
    expect(result.current.speaking).toBe(false)
    expect(mocks.client.initialize).toHaveBeenCalledTimes(1)

    await act(async () => {
      mocks.markReady()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
  })

  it('does not speak while loading', async () => {
    const { result } = renderHook(() => useSpeech())

    await act(async () => {
      result.current.speak('churn')
    })

    expect(mocks.client.speak).not.toHaveBeenCalled()
    expect(mocks.player.play).not.toHaveBeenCalled()
  })

  it('speaks through kokoro and audio player when ready', async () => {
    const { result } = renderHook(() => useSpeech())

    await act(async () => {
      mocks.markReady()
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      result.current.speak('churn')
    })

    expect(mocks.client.speak).toHaveBeenCalledWith('churn')

    await act(async () => {
      mocks.resolveAudio()
    })

    await waitFor(() => {
      expect(mocks.player.play).toHaveBeenCalled()
      expect(result.current.speaking).toBe(true)
      expect(result.current.isSpeaking('churn')).toBe(true)
    })
  })

  it('toggles off when speaking the same active text', async () => {
    const { result } = renderHook(() => useSpeech())

    await act(async () => {
      mocks.markReady()
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      result.current.speak('churn')
    })
    await act(async () => {
      mocks.resolveAudio()
    })
    await waitFor(() => expect(result.current.speaking).toBe(true))

    await act(async () => {
      result.current.speak('churn')
    })

    expect(mocks.client.stop).toHaveBeenCalled()
    expect(mocks.player.stop).toHaveBeenCalled()
    expect(result.current.speaking).toBe(false)
  })

  it('stop clears speaking state', async () => {
    const { result } = renderHook(() => useSpeech())

    await act(async () => {
      mocks.markReady()
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      result.current.speak('churn')
    })
    await act(async () => {
      mocks.resolveAudio()
    })
    await waitFor(() => expect(result.current.speaking).toBe(true))

    await act(async () => {
      result.current.stop()
    })

    expect(result.current.speaking).toBe(false)
    expect(mocks.player.stop).toHaveBeenCalled()
  })

  it('clears speaking when playback ends', async () => {
    const { result } = renderHook(() => useSpeech())

    await act(async () => {
      mocks.markReady()
    })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      result.current.speak('churn')
    })
    await act(async () => {
      mocks.resolveAudio()
    })
    await waitFor(() => expect(result.current.speaking).toBe(true))

    await act(async () => {
      mocks.finishPlayback()
    })

    expect(result.current.speaking).toBe(false)
  })

  it('exposes error status when engine fails to preload', async () => {
    const { result } = renderHook(() => useSpeech())

    await act(async () => {
      mocks.markError('model missing')
    })

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
  })

  it('never references speechSynthesis', () => {
    expect(String(useSpeech)).not.toMatch(/speechSynthesis/)
  })
})
