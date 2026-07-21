// src/renderer/hooks/useTranslationAssistant.ts
//
// Lifecycle of the Lexio assistant window:
//   idle → loading → ready | error
//   idle → no-selection | english-text (from hotkey feedback)

import { useState, useEffect, useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type {
  AssistantState,
  AssistantTextReadyPayload,
  TranslationResponse,
} from '../../types'

const COPIED_RESET_MS = 2_000

export function useTranslationAssistant() {
  const [state, setState] = useState<AssistantState>('idle')
  const [original, setOriginal] = useState('')
  const [translation, setTranslation] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearCopiedTimer = useCallback(() => {
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = null
    }
  }, [])

  const resetCopied = useCallback(() => {
    clearCopiedTimer()
    setCopied(false)
  }, [clearCopiedTimer])

  const handleClose = useCallback(async () => {
    try {
      await invoke('assistant_close')
    } catch (e) {
      console.error('[useTranslationAssistant] close error:', e)
    }
    resetCopied()
    setState('idle')
    setOriginal('')
    setTranslation(null)
    setError(null)
  }, [resetCopied])

  const handleOpenMain = useCallback(async () => {
    try {
      await invoke('assistant_open_main')
    } catch (e) {
      console.error('[useTranslationAssistant] open main error:', e)
    }
    resetCopied()
    setState('idle')
    setOriginal('')
    setTranslation(null)
    setError(null)
  }, [resetCopied])

  const handleCopy = useCallback(async () => {
    if (!translation) return
    try {
      await invoke('assistant_copy_to_clipboard', { text: translation })
      setCopied(true)
      clearCopiedTimer()
      copiedTimerRef.current = setTimeout(() => {
        setCopied(false)
        copiedTimerRef.current = null
      }, COPIED_RESET_MS)
    } catch (e) {
      console.error('[useTranslationAssistant] copy error:', e)
    }
  }, [translation, clearCopiedTimer])

  useEffect(() => {
    return () => clearCopiedTimer()
  }, [clearCopiedTimer])

  useEffect(() => {
    const unlisteners: Array<() => void> = []

    listen('assistant:no-selection', () => {
      resetCopied()
      setState('no-selection')
      setOriginal('')
      setTranslation(null)
      setError(null)
    }).then((fn) => unlisteners.push(fn))

    listen('assistant:english-text', () => {
      resetCopied()
      setState('english-text')
      setOriginal('')
      setTranslation(null)
      setError(null)
    }).then((fn) => unlisteners.push(fn))

    listen<AssistantTextReadyPayload>('assistant:text-ready', async (event) => {
      const text = event.payload.text
      resetCopied()
      setOriginal(text)
      setTranslation(null)
      setError(null)
      setState('loading')

      try {
        const response = await invoke<TranslationResponse>('assistant_translate', { text })
        setOriginal(response.original)
        setTranslation(response.translation)
        setState('ready')
      } catch (e) {
        setError(typeof e === 'string' ? e : 'Erro ao traduzir')
        setState('error')
      }
    }).then((fn) => unlisteners.push(fn))

    return () => unlisteners.forEach((fn) => fn())
  }, [resetCopied])

  useEffect(() => {
    if (state === 'idle') return

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void handleClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, handleClose])

  return { state, original, translation, error, copied, handleCopy, handleClose, handleOpenMain }
}
