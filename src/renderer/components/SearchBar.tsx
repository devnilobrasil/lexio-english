// src/renderer/components/SearchBar.tsx
import React, { useState, useEffect, useRef } from 'react'

interface SearchBarProps {
  onSearch: (query: string) => void
  loading?: boolean
}

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim() && !loading) {
      onSearch(query)
    }
  }

  return (
    <div className="bg-surface-raised border border-border-subtle rounded-lg flex items-center px-3.5 h-10.5 mb-7 transition-colors focus-within:border-text-faint">
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="14" 
        height="14" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className="text-text-faint mr-2.5 shrink-0"
      >
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
      </svg>
      
      <input
        ref={inputRef}
        type="text"
        placeholder="Busque uma palavra em inglês..."
        className="flex-1 font-sans text-sm text-text-primary bg-transparent border-none outline-none placeholder:text-text-faint"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoComplete="off"
        disabled={loading}
      />
      
      <kbd className="font-sans text-[10px] text-text-faint bg-surface-sunken border border-border-subtle rounded-sm px-1.5 py-0.5 ml-2">
        Enter
      </kbd>
    </div>
  )
}
