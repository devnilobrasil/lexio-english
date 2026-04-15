// src/renderer/components/SettingsView.tsx
import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '../lib/tauri-bridge'

type Provider = 'gemini' | 'groq' | 'ollama'

export function SettingsView() {
  const { t } = useTranslation()
  const [apiKey, setApiKey] = useState('')
  const [groqKey, setGroqKey] = useState('')
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434/v1/chat/completions')
  const [ollamaModel, setOllamaModel] = useState('gemma4:26b')
  const [selectedProvider, setSelectedProvider] = useState<Provider>('gemini')
  const [showKey, setShowKey] = useState(false)
  const [showGroqKey, setShowGroqKey] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [version, setVersion] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    invoke<string | null>('get_api_key').then((key) => { if (key) setApiKey(key) })
    invoke<string | null>('get_groq_api_key').then((key) => { if (key) setGroqKey(key) })
    invoke<string | null>('get_ollama_base_url').then((url) => { if (url) setOllamaBaseUrl(url) })
    invoke<string | null>('get_ollama_model').then((model) => { if (model) setOllamaModel(model) })
    invoke<string | null>('get_selected_provider').then((p) => {
      if (p === 'groq' || p === 'ollama') setSelectedProvider(p as Provider)
    })
    invoke<string>('get_app_version').then(setVersion)
  }, [])

  const maskedKey = apiKey
    ? apiKey.slice(0, 7) + '•'.repeat(Math.max(0, apiKey.length - 11)) + apiKey.slice(-4)
    : ''

  const maskedGroqKey = groqKey
    ? groqKey.slice(0, 7) + '•'.repeat(Math.max(0, groqKey.length - 11)) + groqKey.slice(-4)
    : ''

  const canSave = selectedProvider === 'ollama'
    ? ollamaBaseUrl.trim() && ollamaModel.trim()
    : apiKey.trim() || groqKey.trim()

  const handleSave = async () => {
    if (!canSave) return
    setStatus('saving')
    try {
      await invoke<void>('set_api_key', { key: apiKey.trim() })
      await invoke<void>('set_groq_api_key', { key: groqKey.trim() })
      await invoke<void>('set_ollama_base_url', { url: ollamaBaseUrl.trim() })
      await invoke<void>('set_ollama_model', { model: ollamaModel.trim() })
      await invoke<void>('set_selected_provider', { provider: selectedProvider })
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

      {/* AI Provider selector */}
      <div className="flex flex-col gap-2">
        <label className="font-sans text-label font-medium text-text-muted uppercase tracking-caps">
          {t('settings.aiProvider', 'Provedor de AI')}
        </label>

        <div className="flex gap-4">
          {(['gemini', 'groq', 'ollama'] as Provider[]).map((p) => (
            <label key={p} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="provider"
                value={p}
                checked={selectedProvider === p}
                onChange={() => { setSelectedProvider(p); setStatus('idle') }}
                className="accent-[var(--color-accent-text)]"
              />
              <span className="font-sans text-xs text-text-secondary capitalize">
                {p === 'gemini' ? 'Gemini' : p === 'groq' ? 'GROQ' : 'Ollama'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Ollama Configuration (conditional) */}
      {selectedProvider === 'ollama' && (
        <>
          <div className="flex flex-col gap-2">
            <label className="font-sans text-label font-medium text-text-muted uppercase tracking-caps">
              {t('settings.ollamaBaseUrl', 'Ollama Base URL')}
            </label>

            <input
              type="text"
              value={ollamaBaseUrl}
              onChange={(e) => { setOllamaBaseUrl(e.target.value); setStatus('idle') }}
              onKeyDown={handleKeyDown}
              placeholder="http://localhost:11434/v1/chat/completions"
              className="w-full font-mono text-xs text-text-secondary border border-border-subtle rounded-md px-3 py-2 bg-surface-raised outline-none focus:border-accent-text/40 transition-colors"
              spellCheck={false}
            />

            <span className="font-sans text-label text-text-faint">
              {t('settings.ollamaBaseUrlHelper', 'Default: http://localhost:11434/v1/chat/completions')}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-sans text-label font-medium text-text-muted uppercase tracking-caps">
              {t('settings.ollamaModel', 'Ollama Model')}
            </label>

            <input
              type="text"
              value={ollamaModel}
              onChange={(e) => { setOllamaModel(e.target.value); setStatus('idle') }}
              onKeyDown={handleKeyDown}
              placeholder="gemma4:26b"
              className="w-full font-mono text-xs text-text-secondary border border-border-subtle rounded-md px-3 py-2 bg-surface-raised outline-none focus:border-accent-text/40 transition-colors"
              spellCheck={false}
            />

            <span className="font-sans text-label text-text-faint">
              {t('settings.ollamaModelHelper', 'Ex: gemma4:26b, llama3, neural-chat')}
            </span>
          </div>
        </>
      )}

      {/* Gemini API Key and GROQ API Key (only when not Ollama) */}
      {selectedProvider !== 'ollama' && (
        <>
          <div className="flex flex-col gap-2">
            <label className="font-sans text-label font-medium text-text-muted uppercase tracking-caps">
              {t('settings.apiKey')} — Gemini
            </label>

            <input
              ref={inputRef}
              type={showKey ? 'text' : 'password'}
              value={showKey ? apiKey : maskedKey}
              onChange={(e) => { setApiKey(e.target.value); setStatus('idle') }}
              onFocus={() => setShowKey(true)}
              onBlur={() => setShowKey(false)}
              onKeyDown={handleKeyDown}
              placeholder={t('settings.apiKeyPlaceholder')}
              className="w-full font-mono text-xs text-text-secondary border border-border-subtle rounded-md px-3 py-2 bg-surface-raised outline-none focus:border-accent-text/40 transition-colors"
              spellCheck={false}
              autoComplete="off"
            />

            <span className="font-sans text-label text-text-faint">
              {t('settings.apiKeyHelper')}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-sans text-label font-medium text-text-muted uppercase tracking-caps">
              {t('settings.apiKey')} — GROQ
            </label>

            <input
              type={showGroqKey ? 'text' : 'password'}
              value={showGroqKey ? groqKey : maskedGroqKey}
              onChange={(e) => { setGroqKey(e.target.value); setStatus('idle') }}
              onFocus={() => setShowGroqKey(true)}
              onBlur={() => setShowGroqKey(false)}
              onKeyDown={handleKeyDown}
              placeholder="gsk_..."
              className="w-full font-mono text-xs text-text-secondary border border-border-subtle rounded-md px-3 py-2 bg-surface-raised outline-none focus:border-accent-text/40 transition-colors"
              spellCheck={false}
              autoComplete="off"
            />

            <span className="font-sans text-label text-text-faint">
              console.groq.com/keys
            </span>
          </div>
        </>
      )}

      {/* Save button — shared for all providers */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!canSave || status === 'saving'}
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
