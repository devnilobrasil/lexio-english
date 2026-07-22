// src/renderer/lib/appMode.ts

export type AppMode = 'dictionary' | 'translate'

export type WindowResizeState = 'idle' | 'result' | 'translate'

/** Map dictionary windowState + appMode → resize target. */
export function resizeStateFor(
  appMode: AppMode,
  dictionaryWindowState: 'idle' | 'result',
): WindowResizeState {
  if (appMode === 'translate') return 'translate'
  return dictionaryWindowState
}
