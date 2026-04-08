// src/types/index.ts

export type Locale = 'pt-BR' | 'es'

export interface WordExample {
  en: string
  translation: string  // locale-aware (era "pt")
}

export interface VerbForms {
  infinitive: string
  past: string
  past_participle: string
  present_participle: string
  third_person: string
}

export interface MeaningEntry {
  context: string
  meaning_en: string
  meaning_short: string
  meaning: string
  examples: WordExample[]
}

export type PartOfSpeech =
  'verb' | 'noun' | 'adjective' | 'adverb' | 'phrase' | 'idiom' | 'conjunction' | 'preposition'
export type WordLevel = 'Basic' | 'Intermediate' | 'Advanced' | 'Technical'

export interface Word {
  id?: number
  word: string
  phonetic: string | null
  pos: PartOfSpeech | null
  level: WordLevel | null
  verb_forms: VerbForms | null
  meanings: MeaningEntry[]
  synonyms: string[]
  antonyms: string[]
  contexts: string[]
  created_at?: string
  last_viewed?: string
  view_count?: number
  is_saved?: 0 | 1
}

// O que a IA retorna para um locale específico
export interface AIWordResponse {
  word: string
  phonetic: string | null
  pos: PartOfSpeech | null
  level: WordLevel | null
  verb_forms: VerbForms | null
  meanings: MeaningEntry[]
  synonyms: string[]
  antonyms: string[]
  contexts: string[]
}

// API IPC exposta ao renderer via contextBridge
export interface LexioAPI {
  getWord:        (word: string, locale: Locale)          => Promise<Word | null>
  saveWord:       (data: AIWordResponse, locale: Locale)  => Promise<Word>
  toggleSaved:    (word: string)                          => Promise<Word>
  deleteWord:          (word: string) => Promise<void>
  removeFromHistory:   (word: string) => Promise<void>
  unsaveWord:          (word: string) => Promise<void>
  getHistory:     (locale: Locale, limit?: number)        => Promise<Word[]>
  getSaved:       (locale: Locale)                        => Promise<Word[]>
  closeWindow:    ()                                      => void
  minimizeWindow: ()                                      => void
  resizeWindow:   (state: 'idle' | 'result')              => void
  getApiKey:      ()                                      => Promise<string | null>
  setApiKey:      (key: string)                           => Promise<void>
  getAppVersion:  ()                                      => Promise<string>
  onUpdateAvailable:  (cb: (version: string) => void) => void
  onUpdateProgress:   (cb: (pct: number) => void)     => void
  onUpdateDownloaded: (cb: (version: string) => void) => void
  installUpdate:      ()                              => void
}

export type OverlayState = 'idle' | 'loading' | 'success' | 'error'

export interface TextSelection {
  text: string
  programName: string
  coordinates: { x: number; y: number }
}

export interface OverlayAPI {
  onStateChange: (cb: (state: OverlayState) => void) => void
  onError:       (cb: (message: string) => void) => void
  translate:     () => void
  dragStart:     () => void
  setPosition:   (x: number, y: number) => void
}

// Augment global window para o renderer reconhecer window.lexio
declare global {
  interface Window {
    lexio: LexioAPI
    lexioOverlay: OverlayAPI
  }
}
