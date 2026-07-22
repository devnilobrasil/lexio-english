// src/renderer/hooks/useWindowControls.ts
import { useCallback } from 'react'
import { invoke } from '../lib/tauri-bridge'
import type { WindowResizeState } from '../lib/appMode'

export function useWindowControls() {
  const close = useCallback(() => invoke<void>('close_window'), [])
  const minimize = useCallback(() => invoke<void>('minimize_window'), [])
  const resize = useCallback(
    (state: WindowResizeState) => invoke<void>('resize_window', { state }),
    [],
  )

  return { close, minimize, resize }
}
