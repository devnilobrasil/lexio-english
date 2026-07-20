import React from 'react'
import { useTranslation } from 'react-i18next'

interface SpeakButtonProps {
  onSpeak: () => void
  speaking?: boolean
  testId?: string
}

export function SpeakButton({ onSpeak, speaking = false, testId = 'speak-button' }: SpeakButtonProps) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={onSpeak}
      aria-label={t('word.listen')}
      aria-pressed={speaking}
      data-testid={testId}
      className={`flex shrink-0 items-center justify-center w-6 h-6 rounded-sm bg-transparent border border-transparent transition-colors cursor-pointer focus:outline-none focus:border-border-subtle ${
        speaking
          ? 'text-text-primary'
          : 'text-text-faint hover:text-text-secondary hover:bg-surface-hover'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-3.5 h-3.5"
        aria-hidden="true"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
    </button>
  )
}
