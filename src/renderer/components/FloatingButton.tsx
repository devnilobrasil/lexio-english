import { useRef } from 'react'
import lexioIcon from '../../assets/lexio-icon-512.png'
import { useOverlay } from '../hooks/useOverlay'
import '../styles/overlay.css'

export default function FloatingButton() {
  const { state, errorMsg, translate, dragStart, setPosition } = useOverlay()
  const dragRef = useRef<{ startX: number; startY: number; winX: number; winY: number } | null>(null)
  const lastClickRef = useRef<number>(0)
  const DOUBLE_CLICK_MS = 350

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return

    // Manual double-click detection (required for focusable:false windows)
    const now = Date.now()
    if (now - lastClickRef.current < DOUBLE_CLICK_MS) {
      lastClickRef.current = 0
      if (state === 'idle') translate()
      return
    }
    lastClickRef.current = now

    dragStart()
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
      setPosition(dragRef.current.winX + dx, dragRef.current.winY + dy)
    }

    function onMouseUp() {
      dragRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <button
      className={`floating-btn floating-btn--${state}`}
      onMouseDown={handleMouseDown}
      title={errorMsg || 'Traduzir seleção (duplo clique ou Ctrl+Alt+Shift+T)'}
    >
      <img src={lexioIcon} className="btn-icon-img" alt="Lexio" />
    </button>
  )
}
