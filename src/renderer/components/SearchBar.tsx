// src/renderer/components/SearchBar.tsx
import React, { useState, useEffect, useRef } from 'react'

interface SearchBarProps {
  onSearch: (query: string) => void
  loading?: boolean
}

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Foco automático ao abrir o app
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onSearch(query)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative group">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busque uma palavra em inglês..."
          disabled={loading}
          className="w-full h-14 bg-gray-50 border border-gray-200 rounded-2xl px-6 pr-14 text-lg font-medium text-gray-800 placeholder-gray-400 outline-none transition-all focus:bg-white focus:border-blue-400 focus:shadow-[0_0_20px_rgba(59,130,246,0.1)] disabled:opacity-50"
        />
        
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {loading ? (
            <div className="w-5 h-5 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          ) : (
            <kbd className="hidden sm:block px-2 py-1 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-400 group-focus-within:border-blue-200 group-focus-within:text-blue-400 transition-colors">
              ENTER
            </kbd>
          )}
        </div>
      </div>
    </form>
  )
}
