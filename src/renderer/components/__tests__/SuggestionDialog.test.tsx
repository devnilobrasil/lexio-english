import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SuggestionDialog } from '../SuggestionDialog'

describe('SuggestionDialog', () => {
  it('mostra spinner no estado loading', () => {
    render(
      <SuggestionDialog
        state="loading"
        original="Olá mundo"
        translation={null}
        errorMessage={null}
        onAccept={() => {}}
        onReject={() => {}}
      />
    )
    expect(screen.getByLabelText('Traduzindo...')).toBeInTheDocument()
  })

  it('mostra somente a tradução no estado ready (sem texto original)', () => {
    render(
      <SuggestionDialog
        state="ready"
        original="Olá mundo"
        translation="Hello world"
        errorMessage={null}
        onAccept={() => {}}
        onReject={() => {}}
      />
    )
    // Original text is no longer shown in the dialog
    expect(screen.queryByText('Olá mundo')).not.toBeInTheDocument()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('chama onAccept ao clicar em Aceitar', () => {
    const onAccept = vi.fn()
    render(
      <SuggestionDialog
        state="ready"
        original="Texto"
        translation="Text"
        errorMessage={null}
        onAccept={onAccept}
        onReject={() => {}}
      />
    )
    fireEvent.click(screen.getByText('Aceitar'))
    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  it('chama onReject ao clicar em Rejeitar', () => {
    const onReject = vi.fn()
    render(
      <SuggestionDialog
        state="ready"
        original="Texto"
        translation="Text"
        errorMessage={null}
        onAccept={() => {}}
        onReject={onReject}
      />
    )
    fireEvent.click(screen.getByText('Rejeitar'))
    expect(onReject).toHaveBeenCalledTimes(1)
  })

  it('mostra mensagem de erro no estado error', () => {
    render(
      <SuggestionDialog
        state="error"
        original=""
        translation={null}
        errorMessage="Falha na conexão"
        onAccept={() => {}}
        onReject={() => {}}
      />
    )
    expect(screen.getByText('Falha na conexão')).toBeInTheDocument()
    expect(screen.getByText('Fechar')).toBeInTheDocument()
  })

  it('mostra mensagem de erro padrão quando errorMessage é null no estado error', () => {
    render(
      <SuggestionDialog
        state="error"
        original=""
        translation={null}
        errorMessage={null}
        onAccept={() => {}}
        onReject={() => {}}
      />
    )
    expect(screen.getByText('Erro ao traduzir. Tente novamente.')).toBeInTheDocument()
  })

  it('não renderiza botões de ação no estado loading', () => {
    render(
      <SuggestionDialog
        state="loading"
        original="Texto"
        translation={null}
        errorMessage={null}
        onAccept={() => {}}
        onReject={() => {}}
      />
    )
    expect(screen.queryByText('Aceitar')).not.toBeInTheDocument()
    expect(screen.queryByText('Rejeitar')).not.toBeInTheDocument()
  })
})
