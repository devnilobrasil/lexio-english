// src/renderer/components/SettingsView.tsx
import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

export function SettingsView() {
  const { t } = useTranslation()
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [version, setVersion] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.lexio.getApiKey().then((key) => {
      if (key) setApiKey(key)
    })
    window.lexio.getAppVersion().then(setVersion)
  }, [])

  const maskedKey = apiKey
    ? apiKey.slice(0, 7) + '•'.repeat(Math.max(0, apiKey.length - 11)) + apiKey.slice(-4)
    : ''

  const handleSave = async () => {
    if (!apiKey.trim()) return
    setStatus('saving')
    try {
      await window.lexio.setApiKey(apiKey.trim())
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
  }

  return (
    <div className="flex flex-col gap-6 word-card-enter">
      {/* Header */}
      
      {/* API Key Section */}
      <div className="flex flex-col gap-2">
        <label className="font-sans text-label font-medium text-text-muted uppercase tracking-caps">
          {t('settings.apiKey')}
        </label>

        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type={showKey ? 'text' : 'password'}
              value={showKey ? apiKey : maskedKey}
              onChange={(e) => {
                setApiKey(e.target.value)
                setStatus('idle')
              }}
              onFocus={() => setShowKey(true)}
              onBlur={() => setShowKey(false)}
              onKeyDown={handleKeyDown}
              placeholder={t('settings.apiKeyPlaceholder')}
              className="w-full font-mono text-xs text-text-secondary border border-border-subtle rounded-md px-3 py-2 bg-surface-raised outline-none focus:border-accent-text/40 transition-colors"
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!apiKey.trim() || status === 'saving'}
            className="font-sans text-xs font-medium px-4 py-2 rounded-md transition-all duration-150 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: status === 'saved'
                ? 'var(--color-status-online)'
                : 'var(--color-accent-text)',
              color: '#fff',
            }}
          >
            {status === 'saving' ? '...'
              : status === 'saved' ? t('settings.saved')
              : status === 'error' ? '✗'
              : t('settings.save')}
          </button>
        </div>

        <span className="font-sans text-label text-text-faint">
          {t('settings.apiKeyHelper')}
        </span>
      </div>

      {/* Divider */}
      <div className="h-px bg-border-muted" />

      {/* App Info */}
      <div className="flex flex-col gap-2">

        <div className="flex items-center gap-2">
          <span className="font-sans text-xs text-text-secondary">Lexio</span>
          <span className="font-mono text-label text-text-faint bg-surface-sunken px-2 py-0.5 rounded">
            v{version || '...'}
          </span>
        </div>
      </div>
    </div>
  )
}
