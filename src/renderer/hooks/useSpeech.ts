import { useState, useCallback, useEffect, useRef } from 'react'

function normalizeLang(lang: string): string {
  return lang.trim().toLowerCase().replace(/_/g, '-')
}

/** Prefer en-US, then en-GB, then any en-* voice. Never pick pt/es/etc. */
export function pickEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => normalizeLang(v.lang).startsWith('en'))
  if (english.length === 0) return null

  const enUs = english.find((v) => normalizeLang(v.lang) === 'en-us')
  if (enUs) return enUs

  const enGb = english.find((v) => normalizeLang(v.lang) === 'en-gb')
  if (enGb) return enGb

  return english[0] ?? null
}

export function useSpeech() {
  const [activeText, setActiveText] = useState<string | null>(null)
  const generationRef = useRef(0)
  const englishVoiceRef = useRef<SpeechSynthesisVoice | null>(null)

  useEffect(() => {
    if (!window.speechSynthesis) return

    const refreshVoices = () => {
      englishVoiceRef.current = pickEnglishVoice(window.speechSynthesis.getVoices())
    }

    refreshVoices()
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices)

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices)
      window.speechSynthesis.cancel()
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

    // Voices can load late — refresh on each speak if we don't have one yet
    const voice =
      englishVoiceRef.current ??
      pickEnglishVoice(window.speechSynthesis.getVoices())
    if (voice) {
      englishVoiceRef.current = voice
    }

    const utterance = new SpeechSynthesisUtterance(trimmed)
    // Prefer explicit English voice; lang alone is ignored by many Windows installs
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang.replace(/_/g, '-')
    } else {
      utterance.lang = 'en-US'
    }

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
