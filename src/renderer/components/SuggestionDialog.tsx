import type { InlineSuggestionState } from '../../types'

interface SuggestionDialogProps {
  state: Extract<InlineSuggestionState, 'loading' | 'ready' | 'error'>
  original: string
  translation: string | null
  errorMessage: string | null
  onAccept: () => void
  onReject: () => void
}

export function SuggestionDialog({
  state,
  translation,
  errorMessage,
  onAccept,
  onReject,
}: SuggestionDialogProps) {
  return (
    <div className="suggestion-dialog">
      {state === 'loading' && (
        <div className="suggestion-dialog__loading">
          <span className="suggestion-dialog__spinner" aria-label="Traduzindo..." />
        </div>
      )}

      {state === 'ready' && translation && (
        <>
          <div className="suggestion-dialog__body">
            <p className="suggestion-dialog__translation">{translation}</p>
          </div>
          <div className="suggestion-dialog__actions">
            <button
              className="suggestion-dialog__btn suggestion-dialog__btn--ghost"
              onClick={onReject}
            >
              Rejeitar
            </button>
            <button
              className="suggestion-dialog__btn suggestion-dialog__btn--primary"
              onClick={onAccept}
            >
              Aceitar
            </button>
          </div>
        </>
      )}

      {state === 'error' && (
        <>
          <div className="suggestion-dialog__body">
            <p className="suggestion-dialog__error-msg">
              {errorMessage ?? 'Erro ao traduzir. Tente novamente.'}
            </p>
          </div>
          <div className="suggestion-dialog__actions">
            <button
              className="suggestion-dialog__btn suggestion-dialog__btn--ghost"
              onClick={onReject}
            >
              Fechar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
