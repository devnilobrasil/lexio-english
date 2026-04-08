// src/main/text-bridge.ts
// Captura texto selecionado via selection-hook (UIAutomation) e injeta via nut.js (SendInput)

import type { TextSelection } from '../types'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SelectionHook = require('selection-hook')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { keyboard, Key } = require('@nut-tree-fork/nut-js')

const LONG_TEXT_THRESHOLD = 500

let hook: InstanceType<typeof SelectionHook> | null = null

export function initSelectionHook(): void {
  hook = new SelectionHook()
}

export async function captureSelection(): Promise<TextSelection | null> {
  if (!hook) return null

  try {
    const result = hook.getCurrentSelection() as {
      text?: string
      programName?: string
      endBottom?: { x: number; y: number }
    }

    if (!result?.text?.trim()) return null

    return {
      text: result.text,
      programName: result.programName ?? 'unknown',
      coordinates: result.endBottom ?? { x: 0, y: 0 },
    }
  } catch (err) {
    console.error('[text-bridge] captureSelection error:', err)
    return null
  }
}

export async function injectText(text: string): Promise<void> {
  if (text.length <= LONG_TEXT_THRESHOLD) {
    await keyboard.type(text)
    return
  }

  // Clipboard fallback para textos longos (>500 chars)
  const { clipboard } = await import('electron')
  const previous = clipboard.readText()
  clipboard.writeText(text)
  await new Promise(r => setTimeout(r, 50))
  await keyboard.pressKey(Key.LeftControl, Key.V)
  await keyboard.releaseKey(Key.LeftControl, Key.V)
  await new Promise(r => setTimeout(r, 100))
  clipboard.writeText(previous)
}

export function cleanup(): void {
  hook = null
}
