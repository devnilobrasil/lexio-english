// src/renderer/hooks/useAutoUpdater.ts
import { useState, useEffect } from 'react'

type UpdateState =
  | { status: 'idle' }
  | { status: 'available'; version: string }
  | { status: 'progress'; pct: number }
  | { status: 'downloaded'; version: string }

export function useAutoUpdater() {
  const [update, setUpdate] = useState<UpdateState>({ status: 'idle' })

  useEffect(() => {
    window.lexio.onUpdateAvailable((version) => {
      setUpdate({ status: 'available', version })
    })

    window.lexio.onUpdateProgress((pct) => {
      setUpdate({ status: 'progress', pct })
    })

    window.lexio.onUpdateDownloaded((version) => {
      setUpdate({ status: 'downloaded', version })
    })
  }, [])

  const install = () => window.lexio.installUpdate()

  return { update, install }
}
