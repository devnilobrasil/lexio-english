// src/renderer/hooks/useWords.ts
import { useState, useEffect, useCallback } from 'react'
import type { Word } from '../../types'

export function useWords() {
  const [savedWords, setSavedWords] = useState<Word[]>([])
  const [history, setHistory] = useState<Word[]>([])
  const [loading, setLoading] = useState(false)

  const fetchSaved = useCallback(async () => {
    setLoading(true)
    try {
      const words = await window.lexio.getSaved()
      setSavedWords(words)
    } catch (err) {
      console.error('Failed to fetch saved words:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchHistory = useCallback(async (limit = 50) => {
    setLoading(true)
    try {
      const words = await window.lexio.getHistory(limit)
      setHistory(words)
    } catch (err) {
      console.error('Failed to fetch history:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteWord = async (word: string) => {
    try {
      await window.lexio.deleteWord(word)
      // Atualiza ambas as listas após deletar
      fetchSaved()
      fetchHistory()
    } catch (err) {
      console.error('Failed to delete word:', err)
    }
  }

  return {
    savedWords,
    history,
    loading,
    fetchSaved,
    fetchHistory,
    deleteWord
  }
}
