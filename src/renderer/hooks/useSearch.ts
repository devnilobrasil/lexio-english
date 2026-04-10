// src/renderer/hooks/useSearch.ts
import { useState } from 'react'
import type { Word, AIWordResponse } from '../../types'
import { fetchWordFromAI } from '../lib/ai'
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
      // 1. Tenta cache local para este locale
      const localWord = await invoke<Word | null>('get_word', { word: trimmed, locale })

      if (localWord) {
        setWord(localWord)
        setLoading(false)
        return
      }

      // 2. Busca na IA com o locale ativo
      const aiResponse = await fetchWordFromAI(trimmed, locale)

      // 3. Salva no DB com o locale
      const savedWord = await invoke<Word>('save_word', { data: aiResponse as AIWordResponse, locale })

      setWord(savedWord)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ocorreu um erro ao buscar a palavra.'
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
