// src/renderer/hooks/useWords.ts
import { useState, useCallback } from 'react'
import type { Word } from '../../types'
import { useLocale } from './useLocale'

export function useWords() {
  const [savedWords, setSavedWords] = useState<Word[]>([])
  const [history, setHistory] = useState<Word[]>([])
  const [loading, setLoading] = useState(false)
  const { locale } = useLocale()

  const fetchSaved = useCallback(async () => {
    setLoading(true)
    try {
      const words = await window.lexio.getSaved(locale)
      setSavedWords(words)
    } catch (err) {
      console.error('Failed to fetch saved words:', err)
    } finally {
      setLoading(false)
    }
  }, [locale])

  const fetchHistory = useCallback(async (limit = 50) => {
    setLoading(true)
    try {
      const words = await window.lexio.getHistory(locale, limit)
      setHistory(words)
    } catch (err) {
      console.error('Failed to fetch history:', err)
    } finally {
      setLoading(false)
    }
  }, [locale])

  const deleteWord = async (word: string) => {
    try {
      await window.lexio.deleteWord(word)
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
    deleteWord,
  }
}
