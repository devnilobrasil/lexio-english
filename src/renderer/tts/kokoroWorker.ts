import { KokoroTTS, env as kokoroEnv } from 'kokoro-js'
import { env } from '@huggingface/transformers'
import type { WorkerInbound, WorkerOutbound } from './types'

let tts: KokoroTTS | null = null
let activeVoice: 'af_heart' = 'af_heart'
let activeRequestId: string | null = null
let generation = 0

const post = (message: WorkerOutbound, transfer?: Transferable[]) => {
  self.postMessage(message, transfer ? { transfer } : undefined)
}

const installOfflineFetchGuard = (voicePath: string) => {
  const originalFetch = self.fetch.bind(self)

  self.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url

    if (url.includes('/voices/af_heart.bin')) {
      return originalFetch(voicePath, init)
    }

    if (/^https?:\/\//i.test(url)) {
      throw new Error(`Blocked remote TTS fetch: ${url}`)
    }

    return originalFetch(input, init)
  }) as typeof fetch
}

const handleInitialize = async (message: Extract<WorkerInbound, { type: 'initialize' }>) => {
  try {
    env.allowRemoteModels = false
    env.allowLocalModels = true
    env.localModelPath = message.modelPath
    kokoroEnv.wasmPaths = message.wasmPath

    installOfflineFetchGuard(message.voicePath)

    tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'wasm',
    })
    activeVoice = message.voice
    post({ type: 'ready' })
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Failed to initialize Kokoro'
    post({ type: 'error', message: messageText })
  }
}

const handleSpeak = async (message: Extract<WorkerInbound, { type: 'speak' }>) => {
  if (!tts) {
    post({ type: 'error', message: 'Kokoro TTS is not initialized' })
    return
  }

  const requestGeneration = ++generation
  activeRequestId = message.requestId

  try {
    const audio = await tts.generate(message.text, { voice: activeVoice })
    if (requestGeneration !== generation || activeRequestId !== message.requestId) {
      return
    }

    const pcm = new Float32Array(audio.audio)
    const buffer = pcm.buffer.slice(
      pcm.byteOffset,
      pcm.byteOffset + pcm.byteLength,
    )
    post(
      {
        type: 'audio',
        requestId: message.requestId,
        pcm: buffer,
        sampleRate: audio.sampling_rate,
      },
      [buffer],
    )
  } catch (error) {
    if (requestGeneration !== generation) return
    const messageText = error instanceof Error ? error.message : 'Failed to synthesize speech'
    post({ type: 'error', message: messageText })
  }
}

self.onmessage = (event: MessageEvent<WorkerInbound>) => {
  const message = event.data

  if (message.type === 'initialize') {
    void handleInitialize(message)
    return
  }

  if (message.type === 'speak') {
    void handleSpeak(message)
    return
  }

  if (message.type === 'stop') {
    generation += 1
    activeRequestId = null
  }
}
