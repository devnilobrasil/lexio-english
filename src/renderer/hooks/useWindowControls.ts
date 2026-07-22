// src/renderer/hooks/useWindowControls.ts
import { invoke } from '../lib/tauri-bridge'
import type { WindowResizeState } from '../lib/appMode'

export function useWindowControls() {
  return {
    close: () => invoke<void>('close_window'),
    minimize: () => invoke<void>('minimize_window'),
    resize: (state: WindowResizeState) => invoke<void>('resize_window', { state }),
  }
}
