import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TtsStatus } from '../tts/types'

interface SpeakButtonProps {
  onSpeak: () => void
  speaking?: boolean
  status?: TtsStatus
  testId?: string
  className?: string
}

export function SpeakButton({
  onSpeak,
  speaking = false,
  status = 'ready',
  testId = 'speak-button',
  className = '',
}: SpeakButtonProps) {
  const { t } = useTranslation()
  const disabled = status !== 'ready'

  return (
    <button
      type="button"
      onClick={onSpeak}
      disabled={disabled}
      aria-label={t('word.listen')}
      aria-pressed={speaking}
      aria-disabled={disabled}
      data-testid={testId}
      className={`inline-flex shrink-0 align-middle items-center justify-center p-1 leading-none border rounded-md transition-colors focus:outline-none ${
        disabled
          ? 'cursor-not-allowed opacity-50 bg-transparent border-border-subtle text-text-faint'
          : speaking
            ? 'cursor-pointer bg-accent-bg border-accent-text/30 text-accent-text'
            : 'cursor-pointer bg-transparent border-border-subtle text-text-muted hover:border-text-faint hover:text-text-secondary'
      } ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-3.5 h-3.5 block"
        aria-hidden="true"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
    </button>
  )
}
