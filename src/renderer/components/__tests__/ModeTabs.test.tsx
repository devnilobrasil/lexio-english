import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModeTabs } from '../ModeTabs'

describe('ModeTabs', () => {
  it('renders Dicionário and Traduzir tabs', () => {
    render(<ModeTabs mode="dictionary" onChange={() => {}} />)

    expect(screen.getByTestId('mode-tab-dictionary')).toHaveTextContent('Dicionário')
    expect(screen.getByTestId('mode-tab-translate')).toHaveTextContent('Traduzir')
  })

  it('marks the active tab with aria-selected', () => {
    const { rerender } = render(<ModeTabs mode="dictionary" onChange={() => {}} />)

    expect(screen.getByTestId('mode-tab-dictionary')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('mode-tab-translate')).toHaveAttribute('aria-selected', 'false')

    rerender(<ModeTabs mode="translate" onChange={() => {}} />)

    expect(screen.getByTestId('mode-tab-dictionary')).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByTestId('mode-tab-translate')).toHaveAttribute('aria-selected', 'true')
  })

  it('calls onChange when a tab is clicked', () => {
    const onChange = vi.fn()
    render(<ModeTabs mode="dictionary" onChange={onChange} />)

    fireEvent.click(screen.getByTestId('mode-tab-translate'))
    expect(onChange).toHaveBeenCalledWith('translate')

    fireEvent.click(screen.getByTestId('mode-tab-dictionary'))
    expect(onChange).toHaveBeenCalledWith('dictionary')
  })
})
