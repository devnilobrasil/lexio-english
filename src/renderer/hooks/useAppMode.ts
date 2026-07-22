// src/renderer/hooks/useAppMode.ts
import { useState, useEffect, useCallback } from 'react'
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

  const applyResize = useCallback((mode: AppMode, state: DictState) => {
    resize(resizeStateFor(mode, state))
  }, [resize])

  const handleModeChange = useCallback((mode: AppMode) => {
    setAppMode(mode)
    applyResize(mode, dictState)
  }, [applyResize, dictState])

  useEffect(() => {
    const unlisteners: Array<() => void> = []
    for (const event of ASSISTANT_EVENTS) {
      listen(event, () => {
        setAppMode('translate')
        resize('translate')
      }).then((fn) => unlisteners.push(fn))
    }
    return () => unlisteners.forEach((fn) => fn())
  }, [resize])

  useEffect(() => {
    applyResize(appMode, dictState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { appMode, setAppMode, handleModeChange }
}
