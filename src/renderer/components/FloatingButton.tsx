// src/renderer/components/FloatingButton.tsx
import { useEffect, useState, useRef } from 'react'
import type { OverlayState } from '../../types'
import '../styles/overlay.css'

const ICONS: Record<OverlayState, string> = {
  idle:    'L',
  loading: 'L',
  success: '✓',
  error:   '✗',
}

const ICON_CLASSES: Record<OverlayState, string> = {
  idle:    'btn-icon',
  loading: 'btn-icon',
  success: 'btn-icon btn-icon--check',
  error:   'btn-icon btn-icon--error',
}

export default function FloatingButton() {
  const [state, setState] = useState<OverlayState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const dragRef = useRef<{ startX: number; startY: number; winX: number; winY: number } | null>(null)

  useEffect(() => {
    window.lexioOverlay.onStateChange(setState)
    window.lexioOverlay.onError(setErrorMsg)
  }, [])

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    window.lexioOverlay.dragStart()
    dragRef.current = {
      startX: e.screenX,
      startY: e.screenY,
      winX: window.screenX,
      winY: window.screenY,
    }

    function onMouseMove(ev: MouseEvent) {
      if (!dragRef.current) return
      const dx = ev.screenX - dragRef.current.startX
      const dy = ev.screenY - dragRef.current.startY
      window.lexioOverlay.setPosition(
        dragRef.current.winX + dx,
        dragRef.current.winY + dy
      )
    }

    function onMouseUp() {
      dragRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function handleClick() {
    if (state === 'idle') {
      window.lexioOverlay.translate()
    }
  }

  return (
    <button
      className={`floating-btn floating-btn--${state}`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      title={errorMsg || 'Traduzir seleção (Ctrl+Shift+T)'}
    >
      <span className={ICON_CLASSES[state]}>
        {ICONS[state]}
      </span>
    </button>
  )
}
