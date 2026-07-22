import { useState, useCallback, useEffect, useRef } from 'react'
import { createKokoroClient } from '../tts/kokoroClient'
import { createAudioPlayer } from '../tts/audioPlayer'
import type { TtsStatus } from '../tts/types'

export interface SpeechController {
  speak: (text: string) => void
  stop: () => void
  speaking: boolean
  isSpeaking: (text: string) => boolean
  status: TtsStatus
}

export function useSpeech(): SpeechController {
  const [activeText, setActiveText] = useState<string | null>(null)
  const [status, setStatus] = useState<TtsStatus>('loading')
  const generationRef = useRef(0)
  const clientRef = useRef(createKokoroClient())
  const playerRef = useRef(createAudioPlayer())

  useEffect(() => {
    const client = clientRef.current
    const player = playerRef.current
    let cancelled = false

    client
      .initialize()
      .then(() => {
        if (!cancelled) setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      generationRef.current += 1
      client.dispose()
      player.stop()
    }
  }, [])

  const stop = useCallback(() => {
    generationRef.current += 1
    clientRef.current.stop()
    playerRef.current.stop()
    setActiveText(null)
  }, [])

  const speak = useCallback((text: string) => {
    if (status !== 'ready') return

    const trimmed = text.trim()
    if (!trimmed) return

    if (activeText === trimmed) {
      stop()
      return
    }

    const generation = ++generationRef.current
    clientRef.current.stop()
    playerRef.current.stop()
    setActiveText(trimmed)

    void clientRef.current
      .speak(trimmed)
      .then(async (audio) => {
        if (generationRef.current !== generation) return
        await playerRef.current.play(audio.pcm, audio.sampleRate, () => {
          if (generationRef.current === generation) {
            setActiveText(null)
          }
        })
      })
      .catch(() => {
        if (generationRef.current === generation) {
          setActiveText(null)
        }
      })
  }, [activeText, status, stop])

  const isSpeaking = useCallback(
    (text: string) => activeText === text.trim(),
    [activeText],
  )

  return {
    speak,
    stop,
    speaking: activeText !== null,
    isSpeaking,
    status,
  }
}
