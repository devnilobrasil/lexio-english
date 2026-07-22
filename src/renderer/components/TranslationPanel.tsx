import type { AssistantState } from '../../types'
import '../styles/assistant.css'

interface TranslationPanelProps {
  state: AssistantState
  original: string
  translation: string | null
  error: string | null
}

export function TranslationPanel({
  state,
  original,
  translation,
  error,
}: TranslationPanelProps) {
  return (
    <div className="translate-panel" data-testid="assistant-panel">
      <div className="translate-panel-body">
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
