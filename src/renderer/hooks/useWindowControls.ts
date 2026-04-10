// src/renderer/hooks/useWindowControls.ts
import { invoke } from '../lib/tauri-bridge'

export function useWindowControls() {
  return {
    close: () => invoke<void>('close_window'),
    minimize: () => invoke<void>('minimize_window'),
    resize: (state: 'idle' | 'result') => invoke<void>('resize_window', { state }),
  }
}
