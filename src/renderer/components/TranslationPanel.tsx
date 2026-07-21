import { useState, useRef, useEffect } from 'react'
import wordmark from '../../assets/lexio-wordmark.png'
import type { AssistantState } from '../../types'
import { CheckIcon, CloseIcon, CopyIcon, InfoIcon } from './AssistantIcons'
import '../styles/assistant.css'

interface TranslationPanelProps {
  state: AssistantState
  original: string
  translation: string | null
  error: string | null
  copied: boolean
  onCopy: () => void
  onClose: () => void
  onOpenMain: () => void
}

const INFO_TEXT =
  'Selecione texto noutro app e pressione Ctrl+Alt+T para traduzir. ' +
  'A captura pode não funcionar em todos os sítios.'

export function TranslationPanel({
  state,
  original,
  translation,
  error,
  copied,
  onCopy,
  onClose,
  onOpenMain,
}: TranslationPanelProps) {
  const [infoOpen, setInfoOpen] = useState(false)
  const infoRef = useRef<HTMLDivElement>(null)
  const showCopy = state === 'ready' && Boolean(translation)

  useEffect(() => {
    if (!infoOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setInfoOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [infoOpen])

  return (
    <div className="assistant-shell" data-testid="assistant-panel">
      <header className="assistant-header">
        <button
          type="button"
          className="assistant-wordmark-btn"
          onClick={onOpenMain}
          aria-label="Abrir Lexio"
          data-testid="assistant-open-main"
        >
          <img src={wordmark} alt="" className="assistant-wordmark" />
        </button>
        <span className="assistant-title">Traduzir</span>

        <div className="assistant-header-actions" ref={infoRef}>
          {showCopy && (
            <button
              type="button"
              className={[
                'assistant-icon-btn',
                'assistant-icon-btn--copy',
                copied ? 'assistant-icon-btn--copied' : '',
              ].filter(Boolean).join(' ')}
              onClick={onCopy}
              aria-label={copied ? 'Copiado' : 'Copiar tradução'}
              data-testid="assistant-copy"
              aria-live="polite"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          )}
          <button
            type="button"
            className="assistant-icon-btn"
            aria-label="Sobre este modo"
            aria-expanded={infoOpen}
            data-testid="assistant-info"
            onClick={() => setInfoOpen((open) => !open)}
          >
            <InfoIcon />
          </button>
          {infoOpen && (
            <div className="assistant-info-popover" role="tooltip" data-testid="assistant-info-popover">
              <p>{INFO_TEXT}</p>
            </div>
          )}
          <button
            type="button"
            className="assistant-icon-btn"
            onClick={onClose}
            aria-label="Fechar"
            data-testid="assistant-close"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className="assistant-body">
        {state === 'idle' && (
          <p className="assistant-hint">Selecione texto e pressione Ctrl+Alt+T</p>
        )}

        {state === 'loading' && (
          <div className="assistant-loading" aria-label="Traduzindo...">
            <span className="assistant-spinner" />
            <p className="assistant-hint">Traduzindo...</p>
          </div>
        )}

        {state === 'no-selection' && (
          <p className="assistant-message" data-testid="assistant-no-selection">
            Selecione um texto primeiro e tente novamente.
          </p>
        )}

        {state === 'english-text' && (
          <p className="assistant-message" data-testid="assistant-english">
            Texto em inglês detectado. O assistente traduz textos que não estão em inglês.
          </p>
        )}

        {state === 'error' && (
          <p className="assistant-message assistant-message--error" data-testid="assistant-error">
            {error ?? 'Erro ao traduzir. Tente novamente.'}
          </p>
        )}

        {state === 'ready' && translation && (
          <div className="assistant-result" data-testid="assistant-ready">
            <p className="assistant-original">{original}</p>
            <p className="assistant-translation">{translation}</p>
          </div>
        )}
      </div>
    </div>
  )
}
