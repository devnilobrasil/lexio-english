// src/renderer/hooks/useSearch.ts
import { useState } from 'react'
import type { Word } from '../../types'
import { fetchWordFromAI } from '../lib/ai'

export function useSearch() {
  const [word, setWord] = useState<Word | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async (query: string) => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return

    setLoading(true)
    setError(null)

    try {
      // 1. Tenta buscar no DB local (Cache)
      const localWord = await window.lexio.getWord(trimmed)
      
      if (localWord) {
        setWord(localWord)
        setLoading(false)
        return
      }

      // 2. Se não existir, busca na IA (Claude ou Groq)
      const aiResponse = await fetchWordFromAI(trimmed)
      
      // 3. Salva o resultado no DB para cache futuro
      const savedWord = await window.lexio.saveWord(aiResponse)
      
      setWord(savedWord)
    } catch (err: any) {
      console.error('Search error:', err)
      setError(err.message || 'Ocorreu um erro ao buscar a palavra.')
      setWord(null)
    } finally {
      setLoading(false)
    }
  }

  const toggleSaved = async () => {
    if (!word) return
    try {
      const updated = await window.lexio.toggleSaved(word.word)
      setWord(updated)
    } catch (err) {
      console.error('Toggle saved error:', err)
    }
  }

  return { word, loading, error, search, toggleSaved, setWord }
}
