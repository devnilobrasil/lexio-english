// src/renderer/hooks/useOverlay.ts
import { useState, useEffect } from 'react'
import type { OverlayState } from '../../types'
import { invoke, listen } from '../lib/tauri-bridge'

export function useOverlay() {
  const [state, setState] = useState<OverlayState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const unlisteners = Promise.all([
      listen<OverlayState>('overlay:state', (e) => setState(e.payload)),
      listen<string>('overlay:error', (e) => setErrorMsg(e.payload)),
    ])
    return () => {
      unlisteners.then((fns) => fns.forEach((fn) => fn()))
    }
  }, [])

  return {
    state,
    errorMsg,
    translate: () => invoke<void>('overlay_translate'), // stub — implemented in Phase 5
    dragStart: () => invoke<void>('overlay_drag_start'),
    setPosition: (x: number, y: number) =>
      invoke<void>('overlay_set_position', { x, y }),
  }
}
