import { useState, useRef, useEffect } from 'react'
import wordmark from '../../assets/lexio-wordmark.png'
import type { AppMode } from '../lib/appMode'
import { ModeTabs } from './ModeTabs'
import { LocaleSelect } from './LocaleSelect'
import { WindowControls } from './WindowControls'
import {
  CheckIcon,
  CopyIcon,
  ExpandIcon,
  CollapseIcon,
  InfoIcon,
} from './AssistantIcons'

interface TitleBarProps {
  mode: AppMode
  onModeChange: (mode: AppMode) => void
  dictionaryExpanded: boolean
  onToggleExpand: () => void
  showCopy: boolean
  copied: boolean
  onCopy: () => void
}

const INFO_TEXT =
  'Selecione texto noutro app e pressione Ctrl+Alt+T para traduzir. ' +
  'A captura pode não funcionar em todos os sítios.'

export function TitleBar({
  mode,
  onModeChange,
  dictionaryExpanded,
  onToggleExpand,
  showCopy,
  copied,
  onCopy,
}: TitleBarProps) {
  const [infoOpen, setInfoOpen] = useState(false)
  const infoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!infoOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setInfoOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [infoOpen])

  useEffect(() => {
    if (mode !== 'translate') setInfoOpen(false)
  }, [mode])

  return (
    <div className="title-bar" data-testid="title-bar">
      <img
        src={wordmark}
        alt="Lexio"
        className="title-bar-logo"
        data-testid="titlebar-logo"
        draggable={false}
      />

      <ModeTabs mode={mode} onChange={onModeChange} />

      <div className="title-bar-spacer" />

      <div className="title-bar-actions">
        {mode === 'dictionary' && (
          <>
            <button
              type="button"
              className="assistant-icon-btn"
              onClick={onToggleExpand}
              aria-label={dictionaryExpanded ? 'Recolher' : 'Expandir'}
              data-testid="titlebar-expand"
            >
              {dictionaryExpanded ? <CollapseIcon /> : <ExpandIcon />}
            </button>
            <LocaleSelect />
          </>
        )}

        {mode === 'translate' && (
          <div className="title-bar-translate-actions" ref={infoRef}>
            {showCopy && (
              <button
                type="button"
                className={[
                  'assistant-icon-btn',
                  'assistant-icon-btn--copy',
                  copied ? 'assistant-icon-btn--copied' : '',
                ].filter(Boolean).join(' ')}
                onClick={onCopy}
                aria-label={copied ? 'Copiado' : 'Copiar tradução'}
                data-testid="assistant-copy"
                aria-live="polite"
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
            )}
            <button
              type="button"
              className="assistant-icon-btn"
              aria-label="Sobre este modo"
              aria-expanded={infoOpen}
              data-testid="assistant-info"
              onClick={() => setInfoOpen((open) => !open)}
            >
              <InfoIcon />
            </button>
            {infoOpen && (
              <div
                className="assistant-info-popover"
                role="tooltip"
                data-testid="assistant-info-popover"
              >
                <p>{INFO_TEXT}</p>
              </div>
            )}
          </div>
        )}

        <WindowControls />
      </div>
    </div>
  )
}
