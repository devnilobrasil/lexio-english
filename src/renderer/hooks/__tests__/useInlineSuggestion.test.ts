// vi.mock calls are hoisted — factories must NOT reference top-level const/let.
// Use vi.fn() inline in the factory, then set implementations in beforeEach.
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: vi.fn() }))

import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useInlineSuggestion } from '../useInlineSuggestion'
import type { TextSelectedPayload, SuggestionResponse } from '../../../types'

// ── Types ─────────────────────────────────────────────────────────────────────

type EventHandler = (e: { payload: unknown }) => void

// ── Per-test state ────────────────────────────────────────────────────────────

let capturedListeners: Record<string, EventHandler[]>
let mockSetFocus: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()

  capturedListeners = {}
  mockSetFocus = vi.fn().mockResolvedValue(undefined)

  // Capture listen callbacks so tests can trigger events manually
  vi.mocked(listen).mockImplementation((event: string, handler: EventHandler) => {
    if (!capturedListeners[event]) capturedListeners[event] = []
    capturedListeners[event].push(handler)
    return Promise.resolve(() => {
      capturedListeners[event] = (capturedListeners[event] ?? []).filter((h) => h !== handler)
    })
  })

  vi.mocked(getCurrentWindow).mockReturnValue({
    setFocus: mockSetFocus,
  } as ReturnType<typeof getCurrentWindow>)
})

// ── Helper ────────────────────────────────────────────────────────────────────

function fireEvent<T>(event: string, payload: T) {
  ;(capturedListeners[event] ?? []).forEach((h) => h({ payload }))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useInlineSuggestion', () => {
  it('inicia no estado idle', () => {
    const { result } = renderHook(() => useInlineSuggestion())

    expect(result.current.state).toBe('idle')
    expect(result.current.original).toBe('')
    expect(result.current.translation).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('overlay:text-selected dispara transição para available', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined) // overlay_set_position

    const { result } = renderHook(() => useInlineSuggestion())

    const payload: TextSelectedPayload = { text: 'Olá mundo', x: 120, y: 240 }

    await act(async () => {
      fireEvent('overlay:text-selected', payload)
    })

    expect(result.current.state).toBe('available')
    expect(result.current.original).toBe('Olá mundo')
  })

  it('handleBubbleClick não faz nada quando estado não é available', async () => {
    const { result } = renderHook(() => useInlineSuggestion())

    // state is 'idle' — click should be a no-op
    await act(async () => {
      await result.current.handleBubbleClick()
    })

    expect(invoke).not.toHaveBeenCalled()
  })

  it('handleBubbleClick invoca suggestion_request quando available', async () => {
    const mockResponse: SuggestionResponse = {
      original: 'Olá mundo',
      translation: 'Hello world',
    }

    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'overlay_set_size') return Promise.resolve(undefined)
      if (cmd === 'overlay_set_position') return Promise.resolve(undefined)
      if (cmd === 'suggestion_request') return Promise.resolve(mockResponse)
      return Promise.resolve(undefined)
    })

    const { result } = renderHook(() => useInlineSuggestion())

    await act(async () => {
      fireEvent('overlay:text-selected', { text: 'Olá mundo', x: 0, y: 0 })
    })

    expect(result.current.state).toBe('available')

    await act(async () => {
      await result.current.handleBubbleClick()
    })

    expect(invoke).toHaveBeenCalledWith('suggestion_request')
    expect(result.current.state).toBe('ready')
    expect(result.current.translation).toBe('Hello world')
  })

  it('handleBubbleClick define estado error quando suggestion_request falha', async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'overlay_set_size') return Promise.resolve(undefined)
      if (cmd === 'overlay_set_position') return Promise.resolve(undefined)
      if (cmd === 'suggestion_request') return Promise.reject('Chave não configurada')
      return Promise.resolve(undefined)
    })

    const { result } = renderHook(() => useInlineSuggestion())

    await act(async () => {
      fireEvent('overlay:text-selected', { text: 'Olá', x: 0, y: 0 })
    })

    await act(async () => {
      await result.current.handleBubbleClick()
    })

    expect(result.current.state).toBe('error')
    expect(result.current.error).toBe('Chave não configurada')
  })

  it('handleReject invoca suggestion_dismiss e retorna para idle', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined)

    const { result } = renderHook(() => useInlineSuggestion())

    await act(async () => {
      await result.current.handleReject()
    })

    expect(invoke).toHaveBeenCalledWith('suggestion_dismiss')
    expect(result.current.state).toBe('idle')
  })

  it('handleAccept não faz nada quando não há tradução', async () => {
    const { result } = renderHook(() => useInlineSuggestion())

    // translation is null — should be a no-op
    await act(async () => {
      await result.current.handleAccept()
    })

    expect(invoke).not.toHaveBeenCalled()
  })

  it('handleAccept invoca suggestion_accept com a tradução', async () => {
    const mockResponse: SuggestionResponse = { original: 'Olá', translation: 'Hello' }

    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'overlay_set_size') return Promise.resolve(undefined)
      if (cmd === 'overlay_set_position') return Promise.resolve(undefined)
      if (cmd === 'suggestion_request') return Promise.resolve(mockResponse)
      if (cmd === 'suggestion_accept') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })

    const { result } = renderHook(() => useInlineSuggestion())

    // Full flow: text-selected → bubble click → accept
    await act(async () => {
      fireEvent('overlay:text-selected', { text: 'Olá', x: 0, y: 0 })
    })
    await act(async () => {
      await result.current.handleBubbleClick()
    })

    expect(result.current.state).toBe('ready')
    expect(result.current.translation).toBe('Hello')

    await act(async () => {
      await result.current.handleAccept()
    })

    expect(invoke).toHaveBeenCalledWith('suggestion_accept', { text: 'Hello' })
  })
})
