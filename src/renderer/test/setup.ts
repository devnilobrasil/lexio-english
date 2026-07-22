import '@testing-library/jest-dom'
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks'

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  postMessage = () => undefined
  terminate = () => undefined
}

class MockAudioContext {
  destination = {}
  state: AudioContextState = 'running'
  sampleRate = 24000
  resume = async () => {
    this.state = 'running'
  }
  close = async () => undefined
  createBuffer = (channels: number, length: number, sampleRate: number) => {
    const data = new Float32Array(length)
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => data,
    }
  }
  createBufferSource = () => ({
    buffer: null as AudioBuffer | null,
    connect: () => undefined,
    start: () => undefined,
    stop: () => undefined,
    disconnect: () => undefined,
    onended: null as ((this: AudioBufferSourceNode, ev: Event) => void) | null,
  })
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    writable: true,
    value: MockWorker,
  })

  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: MockAudioContext,
  })

  mockIPC((cmd) => {
    if (cmd === 'get_api_key') return null
    if (cmd === 'get_history') return []
    if (cmd === 'get_saved') return []
  })
})

afterEach(() => {
  clearMocks()
})
