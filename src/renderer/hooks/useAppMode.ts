// src/renderer/hooks/useAppMode.ts
import { useState, useEffect, useCallback, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { resizeStateFor, type AppMode } from '../lib/appMode'
import type { WindowResizeState } from '../lib/appMode'

const ASSISTANT_EVENTS = [
  'assistant:text-ready',
  'assistant:no-selection',
  'assistant:english-text',
] as const

type DictState = 'idle' | 'result'

export function useAppMode(
  resize: (state: WindowResizeState) => void,
  dictState: DictState,
) {
  const [appMode, setAppMode] = useState<AppMode>('dictionary')
  const resizeRef = useRef(resize)
  resizeRef.current = resize

  const applyResize = useCallback((mode: AppMode, state: DictState) => {
    resizeRef.current(resizeStateFor(mode, state))
  }, [])

  const handleModeChange = useCallback((mode: AppMode) => {
    setAppMode(mode)
    applyResize(mode, dictState)
  }, [applyResize, dictState])

  useEffect(() => {
    const unlisteners: Array<() => void> = []
    let cancelled = false

    for (const event of ASSISTANT_EVENTS) {
      listen(event, () => {
        setAppMode('translate')
        resizeRef.current('translate')
      }).then((fn) => {
        if (cancelled) {
          fn()
          return
        }
        unlisteners.push(fn)
      })
    }

    return () => {
      cancelled = true
      unlisteners.forEach((fn) => fn())
    }
  }, [])

  useEffect(() => {
    applyResize(appMode, dictState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { appMode, setAppMode, handleModeChange }
}
