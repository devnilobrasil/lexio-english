import { useState, useCallback } from 'react'

export function useSpeech() {
  const [activeText, setActiveText] = useState<string | null>(null)

  const speak = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(trimmed)
    utterance.lang = 'en-US'
    utterance.onstart = () => setActiveText(trimmed)
    utterance.onend = () => setActiveText(null)
    utterance.onerror = () => setActiveText(null)

    window.speechSynthesis.speak(utterance)
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setActiveText(null)
  }, [])

  const isSpeaking = useCallback(
    (text: string) => activeText === text.trim(),
    [activeText],
  )

  return { speak, stop, speaking: activeText !== null, isSpeaking }
}
