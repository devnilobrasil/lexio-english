// src/renderer/hooks/useOverlay.ts
import { useState, useEffect } from 'react'
import type { OverlayState, TextSelectedPayload, InlineSuggestionState } from '../../types'
import { invoke, listen } from '../lib/tauri-bridge'

export function useOverlay() {
  const [state, setState] = useState<OverlayState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [suggestionState, setSuggestionState] = useState<InlineSuggestionState>('idle')
  const [selectedText, setSelectedText] = useState('')
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [suggestionError, setSuggestionError] = useState<string | null>(null)

  useEffect(() => {
    const unlisteners = Promise.all([
      listen<OverlayState>('overlay:state', (e) => setState(e.payload)),
      listen<string>('overlay:error', (e) => setErrorMsg(e.payload)),
      listen<TextSelectedPayload>('overlay:text-selected', (e) => {
        setSelectedText(e.payload.text)
        setCursorPos({ x: e.payload.x, y: e.payload.y })
        setSuggestionState('available')
      }),
      listen<InlineSuggestionState>('overlay:suggestion-state', (e) => {
        setSuggestionState(e.payload)
      }),
      listen<string>('overlay:suggestion-error', (e) => {
        setSuggestionError(e.payload)
        setSuggestionState('error')
      }),
    ])
    return () => {
      unlisteners.then((fns) => fns.forEach((fn) => fn()))
    }
  }, [])

  return {
    state,
    errorMsg,
    translate: () => Promise.resolve(), // stub — reimplemented in Phase 3
    dragStart: () => invoke<void>('overlay_drag_start'),
    setPosition: (x: number, y: number) =>
      invoke<void>('overlay_set_position', { x, y }),
    suggestionState,
    selectedText,
    cursorPos,
    suggestionError,
    setSuggestionState,
  }
}
