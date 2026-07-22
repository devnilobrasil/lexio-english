import type { PcmAudio, TtsStatus, WorkerInbound, WorkerOutbound } from './types'

export interface KokoroClient {
  initialize: () => Promise<void>
  speak: (text: string) => Promise<PcmAudio>
  stop: () => void
  getStatus: () => TtsStatus
  dispose: () => void
}

interface KokoroClientOptions {
  createWorker?: () => Worker
  modelPath?: string
  voicePath?: string
  wasmPath?: string
  voice?: 'af_heart'
}

const PATHS = {
  model: '/kokoro/models/',
  voice: '/kokoro/voices/af_heart.bin',
  wasm: '/kokoro/wasm/',
} as const

function defaultWorker() {
  return new Worker(new URL('./kokoroWorker.ts', import.meta.url), { type: 'module' })
}

export function createKokoroClient(options: KokoroClientOptions = {}): KokoroClient {
  let status: TtsStatus = 'loading'
  let worker: Worker | null = null
  let requestSeq = 0
  let activeRequestId: string | null = null
  let resolveReady: (() => void) | null = null
  let rejectReady: ((error: Error) => void) | null = null
  let resolveSpeak: ((audio: PcmAudio) => void) | null = null
  let rejectSpeak: ((error: Error) => void) | null = null

  const createWorker = options.createWorker ?? defaultWorker
  const post = (message: WorkerInbound) => { worker?.postMessage(message) }

  const clearSpeakWaiters = (error?: Error) => {
    if (error) rejectSpeak?.(error)
    resolveSpeak = null
    rejectSpeak = null
    activeRequestId = null
  }

  const handleMessage = (event: MessageEvent<WorkerOutbound>) => {
    const data = event.data
    if (data.type === 'ready') {
      status = 'ready'
      resolveReady?.()
      resolveReady = null
      rejectReady = null
      return
    }
    if (data.type === 'error') {
      status = 'error'
      const error = new Error(data.message)
      rejectReady?.(error)
      resolveReady = null
      rejectReady = null
      clearSpeakWaiters(error)
      return
    }
    if (data.type === 'audio') {
      if (data.requestId !== activeRequestId) return
      resolveSpeak?.({ pcm: new Float32Array(data.pcm), sampleRate: data.sampleRate })
      clearSpeakWaiters()
    }
  }

  const initialize = () => {
    if (status === 'ready') return Promise.resolve()
    worker = createWorker()
    worker.onmessage = handleMessage
    worker.onerror = (event) => {
      status = 'error'
      rejectReady?.(new Error(event.message || 'Kokoro worker failed'))
      resolveReady = null
      rejectReady = null
    }
    return new Promise<void>((resolve, reject) => {
      resolveReady = resolve
      rejectReady = reject
      post({
        type: 'initialize',
        modelPath: options.modelPath ?? PATHS.model,
        voicePath: options.voicePath ?? PATHS.voice,
        wasmPath: options.wasmPath ?? PATHS.wasm,
        voice: options.voice ?? 'af_heart',
      })
    })
  }

  const speak = (text: string) => {
    if (status !== 'ready' || !worker) {
      return Promise.reject(new Error('Kokoro TTS is not ready'))
    }
    const trimmed = text.trim()
    if (!trimmed) return Promise.reject(new Error('Empty text'))
    if (activeRequestId) clearSpeakWaiters(new Error('Cancelled'))
    const requestId = `req-${++requestSeq}`
    activeRequestId = requestId
    return new Promise<PcmAudio>((resolve, reject) => {
      resolveSpeak = resolve
      rejectSpeak = reject
      post({ type: 'speak', text: trimmed, requestId })
    })
  }

  const stop = () => {
    if (activeRequestId) clearSpeakWaiters(new Error('Cancelled'))
    post({ type: 'stop' })
  }

  const dispose = () => {
    stop()
    worker?.terminate()
    worker = null
    status = 'loading'
  }

  return { initialize, speak, stop, getStatus: () => status, dispose }
}
