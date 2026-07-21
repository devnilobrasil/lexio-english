// src/renderer/overlay-main.tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { TranslationPanel } from './components/TranslationPanel'
import { useTranslationAssistant } from './hooks/useTranslationAssistant'
import './styles/assistant.css'

function AssistantApp() {
  const {
    state,
    original,
    translation,
    error,
    copied,
    handleCopy,
    handleClose,
    handleOpenMain,
  } = useTranslationAssistant()

  return (
    <TranslationPanel
      state={state}
      original={original}
      translation={translation}
      error={error}
      copied={copied}
      onCopy={handleCopy}
      onClose={handleClose}
      onOpenMain={handleOpenMain}
    />
  )
}

createRoot(document.getElementById('overlay-root')!).render(
  <React.StrictMode>
    <AssistantApp />
  </React.StrictMode>,
)
