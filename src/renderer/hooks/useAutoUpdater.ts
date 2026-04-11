// src/renderer/hooks/useAutoUpdater.ts
import { useState, useEffect } from 'react'
import { listen } from '../lib/tauri-bridge'
import { invoke } from '../lib/tauri-bridge'

type UpdateState =
  | { status: 'idle' }
  | { status: 'available'; version: string }
  | { status: 'progress'; pct: number }
  | { status: 'downloaded'; version: string }

export function useAutoUpdater() {
  const [update, setUpdate] = useState<UpdateState>({ status: 'idle' })

  useEffect(() => {
    const unlisteners = Promise.all([
      listen<string>('update:available', (e) => {
        setUpdate({ status: 'available', version: e.payload })
      }),
      listen<number>('update:progress', (e) => {
        setUpdate({ status: 'progress', pct: e.payload })
      }),
      listen<string>('update:downloaded', (e) => {
        setUpdate({ status: 'downloaded', version: e.payload })
      }),
    ])

    return () => {
      unlisteners.then((fns) => fns.forEach((fn) => fn()))
    }
  }, [])

  const install = () => invoke<void>('install_update')

  return { update, install }
}
