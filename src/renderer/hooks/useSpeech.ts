import { useState, useCallback, useEffect, useRef } from 'react'

export function useSpeech() {
  const [activeText, setActiveText] = useState<string | null>(null)
  const generationRef = useRef(0)

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel()
    }
  }, [])

  const stop = useCallback(() => {
    generationRef.current += 1
    window.speechSynthesis.cancel()
    setActiveText(null)
  }, [])

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return

    const trimmed = text.trim()
    if (!trimmed) return

    // Toggle: clicking the same active text stops playback
    if (activeText === trimmed) {
      stop()
      return
    }

    const generation = ++generationRef.current
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(trimmed)
    utterance.lang = 'en-US'
    utterance.onstart = () => {
      if (generationRef.current === generation) {
        setActiveText(trimmed)
      }
    }
    utterance.onend = () => {
      if (generationRef.current === generation) {
        setActiveText(null)
      }
    }
    utterance.onerror = () => {
      if (generationRef.current === generation) {
        setActiveText(null)
      }
    }

    window.speechSynthesis.speak(utterance)
  }, [activeText, stop])

  const isSpeaking = useCallback(
    (text: string) => activeText === text.trim(),
    [activeText],
  )

  return { speak, stop, speaking: activeText !== null, isSpeaking }
}
