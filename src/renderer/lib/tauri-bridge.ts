// Wrapper sobre @tauri-apps/api/core para facilitar migration incremental
import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import { listen as tauriListen } from '@tauri-apps/api/event'

export const invoke = tauriInvoke
export const listen = tauriListen
