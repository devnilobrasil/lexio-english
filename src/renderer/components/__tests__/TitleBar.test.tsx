import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TitleBar } from '../TitleBar'

vi.mock('../LocaleSelect', () => ({
  LocaleSelect: () => <div data-testid="locale-select" />,
}))

vi.mock('../WindowControls', () => ({
  WindowControls: () => <div data-testid="window-controls" />,
}))

describe('TitleBar', () => {
  const base = {
    mode: 'dictionary' as const,
    onModeChange: vi.fn(),
    dictionaryExpanded: false,
    onToggleExpand: vi.fn(),
    showCopy: false,
    copied: false,
    onCopy: vi.fn(),
  }

  it('renders logo, tabs and window controls', () => {
    render(<TitleBar {...base} />)

    expect(screen.getByTestId('titlebar-logo')).toBeInTheDocument()
    expect(screen.getByTestId('mode-tab-dictionary')).toBeInTheDocument()
    // expect(screen.getByTestId('mode-tab-translate')).toBeInTheDocument()
    expect(screen.getByTestId('window-controls')).toBeInTheDocument()
  })

  it('shows expand and locale only in dictionary mode', () => {
    render(<TitleBar {...base} mode="dictionary" />)

    expect(screen.getByTestId('titlebar-expand')).toBeInTheDocument()
    expect(screen.getByTestId('locale-select')).toBeInTheDocument()
    expect(screen.queryByTestId('assistant-info')).not.toBeInTheDocument()
    expect(screen.queryByTestId('assistant-copy')).not.toBeInTheDocument()
  })

  it('shows info in translate mode and hides locale/expand', () => {
    render(<TitleBar {...base} mode="translate" />)

    expect(screen.getByTestId('assistant-info')).toBeInTheDocument()
    expect(screen.queryByTestId('titlebar-expand')).not.toBeInTheDocument()
    expect(screen.queryByTestId('locale-select')).not.toBeInTheDocument()
  })

  it('shows copy only when showCopy is true in translate mode', () => {
    const { rerender } = render(<TitleBar {...base} mode="translate" showCopy={false} />)
    expect(screen.queryByTestId('assistant-copy')).not.toBeInTheDocument()

    rerender(<TitleBar {...base} mode="translate" showCopy />)
    expect(screen.getByTestId('assistant-copy')).toBeInTheDocument()
  })

  it('calls onToggleExpand when expand is clicked', () => {
    const onToggleExpand = vi.fn()
    render(<TitleBar {...base} onToggleExpand={onToggleExpand} />)

    fireEvent.click(screen.getByTestId('titlebar-expand'))
    expect(onToggleExpand).toHaveBeenCalledTimes(1)
  })
})
