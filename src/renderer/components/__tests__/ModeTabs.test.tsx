import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModeTabs } from '../ModeTabs'

describe('ModeTabs', () => {
  it('renders Dicionário tab', () => {
    render(<ModeTabs mode="dictionary" onChange={() => {}} />)

    expect(screen.getByTestId('mode-tab-dictionary')).toHaveTextContent('Dicionário')
  })

  it('marks the active tab with aria-selected', () => {
    render(<ModeTabs mode="dictionary" onChange={() => {}} />)

    expect(screen.getByTestId('mode-tab-dictionary')).toHaveAttribute('aria-selected', 'true')
  })

  it('calls onChange when a tab is clicked', () => {
    const onChange = vi.fn()
    render(<ModeTabs mode="dictionary" onChange={onChange} />)

    fireEvent.click(screen.getByTestId('mode-tab-dictionary'))
    expect(onChange).toHaveBeenCalledWith('dictionary')
  })
})
