// src/renderer/overlay-main.tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import FloatingButton from './components/FloatingButton'
import { useInlineSuggestion } from './hooks/useInlineSuggestion'
import './styles/overlay.css'

function OverlayApp() {
  const { state, original, translation, error, handleBubbleClick, handleAccept, handleReject } =
    useInlineSuggestion()

  return (
    <FloatingButton
      suggestionState={state}
      suggestionOriginal={original}
      suggestionTranslation={translation}
      suggestionError={error}
      onBubbleClick={handleBubbleClick}
      onSuggestionAccept={handleAccept}
      onSuggestionReject={handleReject}
    />
  )
}

createRoot(document.getElementById('overlay-root')!).render(
  <React.StrictMode>
    <OverlayApp />
  </React.StrictMode>,
)
