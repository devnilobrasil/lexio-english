export interface AudioPlayer {
  play: (
    pcm: Float32Array,
    sampleRate: number,
    onEnded?: () => void,
  ) => Promise<void>
  stop: () => void
}

interface AudioPlayerOptions {
  createContext?: () => AudioContext
}

export function createAudioPlayer(options: AudioPlayerOptions = {}): AudioPlayer {
  let context: AudioContext | null = null
  let currentSource: AudioBufferSourceNode | null = null
  let playGeneration = 0

  const getContext = () => {
    if (!context) {
      context = options.createContext
        ? options.createContext()
        : new AudioContext()
    }
    return context
  }

  const stop = () => {
    playGeneration += 1
    if (!currentSource) return

    try {
      currentSource.onended = null
      currentSource.stop()
    } catch {
      // already stopped
    }
    try {
      currentSource.disconnect()
    } catch {
      // already disconnected
    }
    currentSource = null
  }

  const play = async (
    pcm: Float32Array,
    sampleRate: number,
    onEnded?: () => void,
  ) => {
    stop()
    const generation = playGeneration
    const ctx = getContext()

    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    if (generation !== playGeneration) return

    const buffer = ctx.createBuffer(1, pcm.length, sampleRate)
    buffer.getChannelData(0).set(pcm)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.onended = () => {
      if (generation !== playGeneration) return
      if (currentSource === source) {
        currentSource = null
      }
      onEnded?.()
    }

    currentSource = source
    source.start()
  }

  return { play, stop }
}
