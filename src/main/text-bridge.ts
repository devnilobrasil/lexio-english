// src/main/text-bridge.ts
// Captura texto selecionado via selection-hook (UIAutomation) e injeta via nut.js (SendInput)

import type { TextSelection } from '../types'

// Lazy refs — evitam crash do processo main se o módulo nativo falhar ao carregar
let _hook: { start: () => void; stop: () => void; cleanup: () => void; getCurrentSelection: () => unknown; setSelectionPassiveMode: (passive: boolean) => boolean } | null = null
let _keyboard: { config: { autoDelayMs: number }; type: (s: string) => Promise<void>; pressKey: (...k: unknown[]) => Promise<void>; releaseKey: (...k: unknown[]) => Promise<void> } | null = null
let _Key: Record<string, unknown> | null = null

export function initSelectionHook(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SelectionHook = require('selection-hook') as new () => typeof _hook
    _hook = new SelectionHook()
    // Passive mode: não emite eventos automáticos, apenas mantém a seleção atual
    // para `getCurrentSelection()` — padrão recomendado para shortcut triggers
    _hook!.setSelectionPassiveMode(true)
    _hook!.start()
    console.log('[text-bridge] selection-hook initialized (passive mode)')
  } catch (err) {
    console.error('[text-bridge] selection-hook failed to load:', err)
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nutJs = require('@nut-tree-fork/nut-js') as { keyboard: typeof _keyboard; Key: typeof _Key }
    _keyboard = nutJs.keyboard
    _keyboard!.config.autoDelayMs = 0  // remove o delay de 300ms entre cada evento de teclado
    _Key = nutJs.Key
    console.log('[text-bridge] nut-js initialized (autoDelayMs=0)')
  } catch (err) {
    console.error('[text-bridge] nut-js failed to load:', err)
  }
}

export async function captureSelection(): Promise<TextSelection | null> {
  if (!_hook) {
    console.warn('[text-bridge] selection-hook not available')
    return null
  }

  try {
    const result = _hook.getCurrentSelection() as {
      text?: string
      programName?: string
      endBottom?: { x: number; y: number }
    }

    console.log('[text-bridge] selection result:', JSON.stringify(result))

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
  if (!_keyboard || !_Key) {
    console.error('[text-bridge] nut-js not available for injection')
    return
  }

  // Clipboard paste é instantâneo (vs keyboard.type que digita letra por letra)
  const { clipboard } = await import('electron')
  const previous = clipboard.readText()
  clipboard.writeText(text)
  await new Promise(r => setTimeout(r, 60))
  await _keyboard.pressKey(_Key['LeftControl'], _Key['V'])
  await _keyboard.releaseKey(_Key['LeftControl'], _Key['V'])
  await new Promise(r => setTimeout(r, 80))
  clipboard.writeText(previous)
}

export function cleanup(): void {
  _hook?.stop()
  _hook?.cleanup()
  _hook = null
  _keyboard = null
  _Key = null
}
