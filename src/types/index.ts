// src/types/index.ts

export type Locale = 'pt-BR' | 'es'

export interface WordExample {
  en: string
  translation: string  // locale-aware (era "pt")
}

export interface WordTranslation {
  locale: Locale
  meaning: string
  examples: WordExample[]
}

export type PartOfSpeech = 'verb' | 'noun' | 'adjective' | 'adverb' | 'phrase' | 'idiom'
export type WordLevel = 'Basic' | 'Intermediate' | 'Advanced' | 'Technical'

export interface Word {
  id?: number
  word: string
  phonetic: string | null
  pos: PartOfSpeech | null
  level: WordLevel | null
  synonyms: string[]
  contexts: string[]
  translation: WordTranslation  // tradução do locale ativo
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
  synonyms: string[]
  contexts: string[]
  meaning: string
  examples: WordExample[]
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
  onUpdateAvailable:  (cb: (version: string) => void) => void
  onUpdateProgress:   (cb: (pct: number) => void)     => void
  onUpdateDownloaded: (cb: (version: string) => void) => void
  installUpdate:      ()                              => void
}

// Augment global window para o renderer reconhecer window.lexio
declare global {
  interface Window {
    lexio: LexioAPI
  }
}
