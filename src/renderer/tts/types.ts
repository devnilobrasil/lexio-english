export type TtsStatus = 'loading' | 'ready' | 'error'

export type WorkerInbound =
  | {
      type: 'initialize'
      modelPath: string
      voicePath: string
      wasmPath: string
      voice: 'af_heart'
    }
  | {
      type: 'speak'
      text: string
      requestId: string
    }
  | {
      type: 'stop'
    }

export type WorkerOutbound =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | {
      type: 'audio'
      requestId: string
      pcm: ArrayBuffer
      sampleRate: number
    }

export interface PcmAudio {
  pcm: Float32Array
  sampleRate: number
}
