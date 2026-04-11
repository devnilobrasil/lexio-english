import { renderHook, act } from '@testing-library/react'
import { mockIPC } from '@tauri-apps/api/mocks'
import { vi, describe, it, expect } from 'vitest'
import { useSearch } from './useSearch'
import type { Word } from '../../types'

// useSearch depends on useLocale → react-i18next. Stub the minimum surface.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'pt-BR', changeLanguage: vi.fn() },
  }),
}))

const mockWord: Word = {
  word: 'churn',
  phonetic: '/tʃɜːrn/',
  pos: 'verb',
  level: 'Advanced',
  verb_forms: null,
  meanings: [],
  synonyms: ['agitate'],
  antonyms: [],
  contexts: ['Business'],
}

describe('useSearch', () => {
  it('returns word when get_word resolves immediately (cache hit)', async () => {
    mockIPC((cmd) => {
      if (cmd === 'get_word') return mockWord
    })

    const { result } = renderHook(() => useSearch())

    await act(async () => {
      await result.current.search('churn')
    })

    expect(result.current.word).toEqual(mockWord)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('shows loading state during an in-flight search', async () => {
    let resolveSearch!: (v: Word) => void
    const pending = new Promise<Word>((r) => {
      resolveSearch = r
    })

    mockIPC((cmd) => {
      if (cmd === 'get_word') return pending
    })

    const { result } = renderHook(() => useSearch())

    // Fire search but do NOT await — we want to observe loading state
    act(() => {
      void result.current.search('churn')
    })

    expect(result.current.loading).toBe(true)

    // Resolve the pending promise and let state settle
    await act(async () => {
      resolveSearch(mockWord)
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.word).toEqual(mockWord)
  })

  it('sets error state when get_word throws', async () => {
    mockIPC((cmd) => {
      if (cmd === 'get_word') throw new Error('API key not configured')
    })

    const { result } = renderHook(() => useSearch())

    await act(async () => {
      await result.current.search('churn')
    })

    expect(result.current.error).toContain('API key')
    expect(result.current.word).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('ignores blank/whitespace-only search terms', async () => {
    const { result } = renderHook(() => useSearch())

    await act(async () => {
      await result.current.search('   ')
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.word).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('lowercases the search term before invoking', async () => {
    let capturedWord = ''

    mockIPC((cmd, args) => {
      if (cmd === 'get_word') {
        capturedWord = (args as { word: string }).word
        return mockWord
      }
    })

    const { result } = renderHook(() => useSearch())

    await act(async () => {
      await result.current.search('CHURN')
    })

    expect(capturedWord).toBe('churn')
  })

  it('updates word after toggleSaved', async () => {
    const savedWord: Word = { ...mockWord, is_saved: 1 }

    mockIPC((cmd) => {
      if (cmd === 'get_word') return mockWord
      if (cmd === 'toggle_saved') return savedWord
    })

    const { result } = renderHook(() => useSearch())

    await act(async () => {
      await result.current.search('churn')
    })

    expect(result.current.word?.is_saved).toBeUndefined()

    await act(async () => {
      await result.current.toggleSaved()
    })

    expect(result.current.word?.is_saved).toBe(1)
  })
})
