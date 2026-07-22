import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createKokoroClient } from '../kokoroClient'
import type { WorkerInbound, WorkerOutbound } from '../types'

class MockWorker {
  onmessage: ((event: MessageEvent<WorkerOutbound>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  postMessage = vi.fn((message: WorkerInbound) => {
    this.messages.push(message)
  })
  terminate = vi.fn()
  messages: WorkerInbound[] = []

  emit(data: WorkerOutbound, transfer?: Transferable[]) {
    void transfer
    this.onmessage?.({ data } as MessageEvent<WorkerOutbound>)
  }
}

describe('createKokoroClient', () => {
  let worker: MockWorker

  beforeEach(() => {
    worker = new MockWorker()
  })

  it('starts in loading and becomes ready after worker ready message', async () => {
    const client = createKokoroClient({
      createWorker: () => worker as unknown as Worker,
    })

    expect(client.getStatus()).toBe('loading')

    const readyPromise = client.initialize()
    expect(worker.messages[0]).toEqual({
      type: 'initialize',
      modelPath: '/kokoro/models/',
      voicePath: '/kokoro/voices/af_heart.bin',
      wasmPath: '/kokoro/wasm/',
      voice: 'af_heart',
    })

    worker.emit({ type: 'ready' })
    await readyPromise

    expect(client.getStatus()).toBe('ready')
  })

  it('reports error when worker fails to initialize', async () => {
    const client = createKokoroClient({
      createWorker: () => worker as unknown as Worker,
    })

    const readyPromise = client.initialize()
    worker.emit({ type: 'error', message: 'model missing' })

    await expect(readyPromise).rejects.toThrow('model missing')
    expect(client.getStatus()).toBe('error')
  })

  it('synthesizes text and returns transferable PCM without network', async () => {
    const client = createKokoroClient({
      createWorker: () => worker as unknown as Worker,
    })

    const readyPromise = client.initialize()
    worker.emit({ type: 'ready' })
    await readyPromise

    const pcmPromise = client.speak('churn')
    const speakMsg = worker.messages.find((m) => m.type === 'speak')
    expect(speakMsg).toMatchObject({ type: 'speak', text: 'churn', requestId: expect.any(String) })

    const buffer = new Float32Array([0.1, 0.2, 0.3]).buffer
    worker.emit({
      type: 'audio',
      requestId: (speakMsg as { requestId: string }).requestId,
      pcm: buffer,
      sampleRate: 24000,
    })

    const result = await pcmPromise
    expect(result.sampleRate).toBe(24000)
    expect(result.pcm).toHaveLength(3)
    expect(result.pcm[0]).toBeCloseTo(0.1)
    expect(result.pcm[1]).toBeCloseTo(0.2)
    expect(result.pcm[2]).toBeCloseTo(0.3)
  })

  it('cancels in-flight speak when stop is called', async () => {
    const client = createKokoroClient({
      createWorker: () => worker as unknown as Worker,
    })

    const readyPromise = client.initialize()
    worker.emit({ type: 'ready' })
    await readyPromise

    const pcmPromise = client.speak('first')
    const speakMsg = worker.messages.find((m) => m.type === 'speak') as { requestId: string }

    client.stop()
    expect(worker.messages.some((m) => m.type === 'stop')).toBe(true)

    worker.emit({
      type: 'audio',
      requestId: speakMsg.requestId,
      pcm: new Float32Array([1]).buffer,
      sampleRate: 24000,
    })

    await expect(pcmPromise).rejects.toThrow(/cancel/i)
  })
})
