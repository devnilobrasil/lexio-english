vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))

import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useTranslationAssistant } from '../useTranslationAssistant'
import type { TranslationResponse } from '../../../types'

type EventHandler = (e: { payload: unknown }) => void

let capturedListeners: Record<string, EventHandler[]>

beforeEach(() => {
  vi.clearAllMocks()
  capturedListeners = {}

  vi.mocked(listen).mockImplementation((event: string, handler: EventHandler) => {
    if (!capturedListeners[event]) capturedListeners[event] = []
    capturedListeners[event].push(handler)
    return Promise.resolve(() => {
      capturedListeners[event] = (capturedListeners[event] ?? []).filter((h) => h !== handler)
    })
  })
})

function fireEvent<T>(event: string, payload: T) {
  ;(capturedListeners[event] ?? []).forEach((h) => h({ payload }))
}

describe('useTranslationAssistant', () => {
  it('inicia no estado idle', () => {
    const { result } = renderHook(() => useTranslationAssistant())

    expect(result.current.state).toBe('idle')
    expect(result.current.original).toBe('')
    expect(result.current.translation).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.copied).toBe(false)
  })

  it('assistant:no-selection define estado no-selection', async () => {
    const { result } = renderHook(() => useTranslationAssistant())

    await act(async () => {
      fireEvent('assistant:no-selection', null)
    })

    expect(result.current.state).toBe('no-selection')
  })

  it('assistant:english-text define estado english-text', async () => {
    const { result } = renderHook(() => useTranslationAssistant())

    await act(async () => {
      fireEvent('assistant:english-text', null)
    })

    expect(result.current.state).toBe('english-text')
  })

  it('assistant:text-ready traduz e passa para ready', async () => {
    const mockResponse: TranslationResponse = {
      original: 'Olá mundo',
      translation: 'Hello world',
    }

    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'assistant_translate') return Promise.resolve(mockResponse)
      return Promise.resolve(undefined)
    })

    const { result } = renderHook(() => useTranslationAssistant())

    await act(async () => {
      fireEvent('assistant:text-ready', { text: 'Olá mundo' })
      await Promise.resolve()
    })

    expect(invoke).toHaveBeenCalledWith('assistant_translate', { text: 'Olá mundo' })
    expect(result.current.state).toBe('ready')
    expect(result.current.original).toBe('Olá mundo')
    expect(result.current.translation).toBe('Hello world')
  })

  it('assistant:text-ready define error quando translate falha', async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'assistant_translate') return Promise.reject('Chave não configurada')
      return Promise.resolve(undefined)
    })

    const { result } = renderHook(() => useTranslationAssistant())

    await act(async () => {
      fireEvent('assistant:text-ready', { text: 'Olá' })
      await Promise.resolve()
    })

    expect(result.current.state).toBe('error')
    expect(result.current.error).toBe('Chave não configurada')
  })

  it('handleCopy invoca assistant_copy_to_clipboard e marca copied', async () => {
    vi.useFakeTimers()
    const mockResponse: TranslationResponse = {
      original: 'Olá',
      translation: 'Hello',
    }

    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'assistant_translate') return Promise.resolve(mockResponse)
      return Promise.resolve(undefined)
    })

    const { result } = renderHook(() => useTranslationAssistant())

    await act(async () => {
      fireEvent('assistant:text-ready', { text: 'Olá' })
      await Promise.resolve()
    })

    expect(result.current.copied).toBe(false)

    await act(async () => {
      await result.current.handleCopy()
    })

    expect(invoke).toHaveBeenCalledWith('assistant_copy_to_clipboard', { text: 'Hello' })
    expect(result.current.copied).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.copied).toBe(false)
    vi.useRealTimers()
  })

  it('handleCopy é no-op sem tradução', async () => {
    const { result } = renderHook(() => useTranslationAssistant())

    await act(async () => {
      await result.current.handleCopy()
    })

    expect(invoke).not.toHaveBeenCalled()
    expect(result.current.copied).toBe(false)
  })

  it('handleClose limpa copied e volta a idle', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined)

    const { result } = renderHook(() => useTranslationAssistant())

    await act(async () => {
      fireEvent('assistant:no-selection', null)
    })
    expect(result.current.state).toBe('no-selection')

    await act(async () => {
      await result.current.handleClose()
    })

    expect(invoke).toHaveBeenCalledWith('assistant_close')
    expect(result.current.state).toBe('idle')
    expect(result.current.original).toBe('')
    expect(result.current.translation).toBeNull()
    expect(result.current.copied).toBe(false)
  })

  it('handleOpenMain invoca assistant_open_main e volta a idle', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined)

    const { result } = renderHook(() => useTranslationAssistant())

    await act(async () => {
      fireEvent('assistant:no-selection', null)
    })

    await act(async () => {
      await result.current.handleOpenMain()
    })

    expect(invoke).toHaveBeenCalledWith('assistant_open_main')
    expect(result.current.state).toBe('idle')
  })
})
