// src/renderer/components/SearchBar.tsx
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface SearchBarProps {
  onSearch: (query: string) => void
  onEscape: () => void
  loading?: boolean
}

export function SearchBar({ onSearch, onEscape, loading }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleFocus = () => inputRef.current?.focus()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim() && !loading) {
      onSearch(query.trim().toLowerCase())
    }
    if (e.key === 'Escape') {
      if (query) {
        setQuery('')
      } else {
        onEscape()
      }
    }
  }

  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        data-testid="search-input"
        type="text"
        placeholder={t('search.placeholder')}
        className="flex-1 font-sans text-sm text-text-primary border-none outline-none placeholder:text-text-faint px-4 rounded-xl h-8 bg-text-faint/25"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoComplete="off"
        disabled={loading}
      />
    </div>
  )
}
