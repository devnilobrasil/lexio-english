import { useRef } from 'react'
import lexioIcon from '../../assets/lexio-icon-512.png'
import { invoke } from '../lib/tauri-bridge'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { SuggestionDialog } from './SuggestionDialog'
import type { InlineSuggestionState } from '../../types'
import '../styles/overlay.css'

interface FloatingButtonProps {
  suggestionState: InlineSuggestionState
  suggestionOriginal: string
  suggestionTranslation: string | null
  suggestionError: string | null
  onBubbleClick: () => void
  onSuggestionAccept: () => void
  onSuggestionReject: () => void
}

export default function FloatingButton({
  suggestionState,
  suggestionOriginal,
  suggestionTranslation,
  suggestionError,
  onBubbleClick,
  onSuggestionAccept,
  onSuggestionReject,
}: FloatingButtonProps) {
  const dragRef = useRef<{ startX: number; startY: number; winX: number; winY: number } | null>(null)

  const isDialogOpen =
    suggestionState === 'loading' ||
    suggestionState === 'ready' ||
    suggestionState === 'error'

  async function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return

    const startX = e.screenX
    const startY = e.screenY

    invoke<void>('overlay_drag_start')

    // Use outerPosition() for the true physical window position.
    // window.screenX/Y is unreliable inside a Tauri WebView.
    const pos = await getCurrentWindow().outerPosition()
    dragRef.current = {
      startX,
      startY,
      winX: pos.x,
      winY: pos.y,
    }

    const dpr = window.devicePixelRatio || 1

    function onMouseMove(ev: MouseEvent) {
      if (!dragRef.current) return
      const dx = ev.screenX - dragRef.current.startX
      const dy = ev.screenY - dragRef.current.startY
      // screenX/Y delta is in logical pixels; overlay_set_position expects physical.
      invoke<void>('overlay_set_position', {
        x: Math.round(dragRef.current.winX + dx * dpr),
        y: Math.round(dragRef.current.winY + dy * dpr),
      })
    }

    function onMouseUp() {
      dragRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // Map InlineSuggestionState to a CSS modifier for the button.
  // 'ready' has no dedicated style — button is secondary when dialog is visible.
  const btnStyle: Record<InlineSuggestionState, string> = {
    idle: 'idle',
    available: 'available',
    loading: 'loading',
    ready: 'idle',
    error: 'error',
  }

  return (
    <div className={isDialogOpen ? 'overlay--expanded' : ''}>
      <button
        className={['floating-btn', `floating-btn--${btnStyle[suggestionState]}`].join(' ')}
        onMouseDown={suggestionState === 'idle' ? handleMouseDown : undefined}
        onClick={suggestionState === 'available' ? onBubbleClick : undefined}
        title="Traduzir seleção"
      >
        <img src={lexioIcon} className="btn-icon-img" alt="Lexio" />
      </button>

      {isDialogOpen && (
        <SuggestionDialog
          state={suggestionState as 'loading' | 'ready' | 'error'}
          original={suggestionOriginal}
          translation={suggestionTranslation}
          errorMessage={suggestionError}
          onAccept={onSuggestionAccept}
          onReject={onSuggestionReject}
        />
      )}
    </div>
  )
}
