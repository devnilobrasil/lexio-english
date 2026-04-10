// src/renderer/hooks/useSearch.ts
import { useState } from 'react'
import type { Word } from '../../types'
import { invoke } from '../lib/tauri-bridge'
import { useLocale } from './useLocale'

export function useSearch() {
  const [word, setWord] = useState<Word | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const { locale } = useLocale()

  const search = async (searchTerm: string) => {
    const trimmed = searchTerm.trim().toLowerCase()
    if (!trimmed) return

    setQuery(trimmed)
    setLoading(true)
    setError(null)

    try {
      // get_word handles everything: DB cache → Gemini → auto-save
      const result = await invoke<Word | null>('get_word', { word: trimmed, locale })
      setWord(result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('Search error:', err)
      setError(message)
      setWord(null)
    } finally {
      setLoading(false)
    }
  }

  const toggleSaved = async () => {
    if (!word) return
    try {
      const updated = await invoke<Word>('toggle_saved', { word: word.word })
      setWord(updated)
    } catch (err) {
      console.error('Toggle saved error:', err)
    }
  }

  return { word, loading, error, search, toggleSaved, setWord, query }
}
