import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExampleItem } from '../ExampleItem'

describe('ExampleItem', () => {
  it('renders API text safely without injecting HTML', () => {
    const { container } = render(
      <ExampleItem
        example={{ en: '<b>danger</b> plain text', translation: 'traducao' }}
        word="cat"
        itemNumber={1}
        showSeparator={false}
      />,
    )

    expect(screen.getByText('<b>danger</b> plain text')).toBeInTheDocument()
    expect(container.querySelector('b')).not.toBeInTheDocument()
  })

  it('does not crash when word has regex characters', () => {
    render(
      <ExampleItem
        example={{ en: 'I use c++ every day.', translation: 'Eu uso c++ todo dia.' }}
        word="c++"
        itemNumber={1}
        showSeparator={false}
      />,
    )

    expect(screen.getByText('I use c++ every day.')).toBeInTheDocument()
    expect(screen.getByText('Eu uso c++ todo dia.')).toBeInTheDocument()
  })
})
