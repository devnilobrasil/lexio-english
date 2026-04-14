// src/renderer/hooks/useInlineSuggestion.ts
//
// Manages the full lifecycle of the inline translation feature:
//   idle → available (text selected nearby) → loading (API call) → ready (translation shown)
//   → accept (text injected) | reject (dismissed)
//
// This hook owns window resize and positioning.

import { useState, useEffect, useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { InlineSuggestionState, TextSelectedPayload, SuggestionResponse } from '../../types'
import { BTN_SIZE, DIALOG_WIDTH, DIALOG_HEIGHT, bubblePosition, dialogPosition } from './positioning'

const AVAILABLE_TIMEOUT_MS = 6_000  // 6 s without clicking → back to idle
const READY_TIMEOUT_MS = 30_000     // 30 s without interacting → close dialog

export function useInlineSuggestion() {
  const [state, setState] = useState<InlineSuggestionState>('idle')
  const [original, setOriginal] = useState('')
  const [translation, setTranslation] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const availableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Cursor position at time of text selection — used to reposition when dialog expands
  const cursorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // ── Timer helpers ────────────────────────────────────────────────────────

  const clearAvailableTimer = useCallback(() => {
    if (availableTimerRef.current) {
      clearTimeout(availableTimerRef.current)
      availableTimerRef.current = null
    }
  }, [])

  const clearReadyTimer = useCallback(() => {
    if (readyTimerRef.current) {
      clearTimeout(readyTimerRef.current)
      readyTimerRef.current = null
    }
  }, [])

  // ── Transition to idle — clears all ephemeral state ──────────────────────

  const goIdle = useCallback(() => {
    clearAvailableTimer()
    clearReadyTimer()
    setState('idle')
    setOriginal('')
    setTranslation(null)
    setError(null)
  }, [clearAvailableTimer, clearReadyTimer])

  // ── Reject / dismiss — also used by ESC key handler and ready-timeout ────

  const handleReject = useCallback(async () => {
    clearReadyTimer()
    try {
      await invoke('suggestion_dismiss')
    } catch (e) {
      console.error('[useInlineSuggestion] dismiss error:', e)
    }
    await invoke<void>('overlay_set_size', { width: BTN_SIZE, height: BTN_SIZE })
    goIdle()
  }, [clearReadyTimer, goIdle])

  // ── Accept — injects translated text into focused app ────────────────────

  const handleAccept = useCallback(async () => {
    if (!translation) return
    clearReadyTimer()
    try {
      await invoke('suggestion_accept', { text: translation })
      // Rust emits overlay:suggestion-state=idle → goIdle() fires via listener
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Erro ao aceitar')
      setState('error')
      return
    }
    await invoke<void>('overlay_set_size', { width: BTN_SIZE, height: BTN_SIZE })
  }, [translation, clearReadyTimer])

  // ── Bubble click — repositions for dialog, then triggers AI call ─────────

  const handleBubbleClick = useCallback(async () => {
    if (state !== 'available') return
    clearAvailableTimer()

    // cursorRef stores logical coords. Convert to physical for IPC.
    const dpr = window.devicePixelRatio || 1
    const { x, y } = dialogPosition(
      cursorRef.current.x,
      cursorRef.current.y,
      window.screen.width,
      window.screen.height,
    )
    await invoke<void>('overlay_set_position', { x: Math.round(x * dpr), y: Math.round(y * dpr) })
    await invoke<void>('overlay_set_size', { width: DIALOG_WIDTH, height: DIALOG_HEIGHT })

    // Do NOT setFocus() on the overlay — the source app must keep keyboard focus
    // so that suggestion_accept can inject text via Ctrl+V into the right window.

    try {
      const response = await invoke<SuggestionResponse>('suggestion_request')
      setTranslation(response.translation)
      setOriginal(response.original)
      setState('ready')
      readyTimerRef.current = setTimeout(handleReject, READY_TIMEOUT_MS)
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Erro ao traduzir')
      setState('error')
    }
  }, [state, clearAvailableTimer, handleReject])

  // ── Backend event listeners ──────────────────────────────────────────────

  useEffect(() => {
    const unlisteners: Array<() => void> = []

    listen<TextSelectedPayload>('overlay:text-selected', async (event) => {
      clearAvailableTimer()
      clearReadyTimer()
      setOriginal(event.payload.text)
      setTranslation(null)
      setError(null)
      setState('available')

      // Cursor coords from Rust (WH_MOUSE_LL) are physical pixels.
      // Positioning functions work in logical CSS pixels, so normalize first.
      const dpr = window.devicePixelRatio || 1
      const logX = event.payload.x / dpr
      const logY = event.payload.y / dpr

      // Store logical coords — handleBubbleClick reads these
      cursorRef.current = { x: logX, y: logY }

      // Position the bubble near the cursor, clamped to screen edges
      const pos = bubblePosition(logX, logY, window.screen.width, window.screen.height)
      try {
        // Convert back to physical pixels for overlay_set_position
        await invoke<void>('overlay_set_position', {
          x: Math.round(pos.x * dpr),
          y: Math.round(pos.y * dpr),
        })
      } catch (e) {
        console.error('[useInlineSuggestion] setPosition error:', e)
      }

      availableTimerRef.current = setTimeout(goIdle, AVAILABLE_TIMEOUT_MS)
    }).then((fn) => unlisteners.push(fn))

    listen<InlineSuggestionState>('overlay:suggestion-state', (event) => {
      if (event.payload === 'idle') {
        goIdle()
      } else {
        setState(event.payload)
      }
    }).then((fn) => unlisteners.push(fn))

    listen<string>('overlay:suggestion-error', (event) => {
      setError(event.payload)
      setState('error')
    }).then((fn) => unlisteners.push(fn))

    return () => unlisteners.forEach((fn) => fn())
  }, [goIdle, clearAvailableTimer, clearReadyTimer])

  // ── ESC key closes dialog when it is open ────────────────────────────────

  useEffect(() => {
    const isDialogOpen = state === 'loading' || state === 'ready' || state === 'error'
    if (!isDialogOpen) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void handleReject()
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, handleReject])

  return { state, original, translation, error, handleBubbleClick, handleAccept, handleReject }
}
