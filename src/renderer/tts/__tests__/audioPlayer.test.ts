import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createAudioPlayer } from '../audioPlayer'

type FakeSource = {
  buffer: AudioBuffer | null
  connect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  onended: ((this: AudioBufferSourceNode, ev: Event) => void) | null
  disconnect: ReturnType<typeof vi.fn>
}

function createMockAudioContext() {
  const sources: FakeSource[] = []
  const destination = {} as AudioDestinationNode

  const ctx = {
    sampleRate: 24000,
    destination,
    state: 'running' as AudioContextState,
    resume: vi.fn(async () => {
      ctx.state = 'running'
    }),
    createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => {
      const data = new Float32Array(length)
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        getChannelData: vi.fn(() => data),
      } as unknown as AudioBuffer
    }),
    createBufferSource: vi.fn(() => {
      const source: FakeSource = {
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
        disconnect: vi.fn(),
      }
      sources.push(source)
      return source as unknown as AudioBufferSourceNode
    }),
    close: vi.fn(async () => undefined),
  }

  return { ctx: ctx as unknown as AudioContext, sources }
}

describe('createAudioPlayer', () => {
  let audioContext: AudioContext
  let sources: FakeSource[]

  beforeEach(() => {
    const mock = createMockAudioContext()
    audioContext = mock.ctx
    sources = mock.sources
  })

  it('plays PCM float32 data through a single AudioContext', async () => {
    const player = createAudioPlayer({ createContext: () => audioContext })
    const pcm = new Float32Array([0, 0.5, -0.5, 1])
    const onEnded = vi.fn()

    await player.play(pcm, 24000, onEnded)

    expect(audioContext.createBuffer).toHaveBeenCalledWith(1, 4, 24000)
    expect(sources).toHaveLength(1)
    expect(sources[0].start).toHaveBeenCalledTimes(1)
    expect(sources[0].connect).toHaveBeenCalledWith(audioContext.destination)
  })

  it('stops previous source before starting a new one', async () => {
    const player = createAudioPlayer({ createContext: () => audioContext })

    await player.play(new Float32Array([0.1, 0.2]), 24000)
    await player.play(new Float32Array([0.3, 0.4]), 24000)

    expect(sources).toHaveLength(2)
    expect(sources[0].stop).toHaveBeenCalledTimes(1)
    expect(sources[1].start).toHaveBeenCalledTimes(1)
  })

  it('stop ends current playback without starting another source', async () => {
    const player = createAudioPlayer({ createContext: () => audioContext })

    await player.play(new Float32Array([0.1, 0.2]), 24000)
    player.stop()

    expect(sources[0].stop).toHaveBeenCalledTimes(1)
    expect(sources).toHaveLength(1)
  })

  it('invokes onEnded when the current source finishes', async () => {
    const player = createAudioPlayer({ createContext: () => audioContext })
    const onEnded = vi.fn()

    await player.play(new Float32Array([0.1]), 24000, onEnded)
    sources[0].onended?.call(sources[0] as unknown as AudioBufferSourceNode, new Event('ended'))

    expect(onEnded).toHaveBeenCalledTimes(1)
  })
})
