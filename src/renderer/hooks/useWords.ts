// src/renderer/hooks/useWords.ts
import { useState, useCallback } from 'react'
import type { Word } from '../../types'
import { invoke } from '../lib/tauri-bridge'
import { useLocale } from './useLocale'

export function useWords() {
  const [savedWords, setSavedWords] = useState<Word[]>([])
  const [history, setHistory] = useState<Word[]>([])
  const [loading, setLoading] = useState(false)
  const { locale } = useLocale()

  const fetchSaved = useCallback(async () => {
    setLoading(true)
    try {
      const words = await invoke<Word[]>('get_saved', { locale })
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
      const words = await invoke<Word[]>('get_history', { locale, limit })
      setHistory(words)
    } catch (err) {
      console.error('Failed to fetch history:', err)
    } finally {
      setLoading(false)
    }
  }, [locale])

  const deleteWord = async (word: string) => {
    try {
      await invoke<void>('delete_word', { word })
      fetchSaved()
      fetchHistory()
    } catch (err) {
      console.error('Failed to delete word:', err)
    }
  }

  const removeFromHistory = async (word: string) => {
    try {
      await invoke<void>('remove_from_history', { word })
      fetchHistory()
    } catch (err) {
      console.error('Failed to remove word from history:', err)
    }
  }

  const unsaveWord = async (word: string) => {
    try {
      await invoke<void>('unsave_word', { word })
      fetchSaved()
    } catch (err) {
      console.error('Failed to unsave word:', err)
    }
  }

  return {
    savedWords,
    history,
    loading,
    fetchSaved,
    fetchHistory,
    deleteWord,
    removeFromHistory,
    unsaveWord,
  }
}
