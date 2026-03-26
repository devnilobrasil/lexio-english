// src/types/index.ts

export interface WordExample {
  en: string
  pt: string
}

export type PartOfSpeech = 'verb' | 'noun' | 'adjective' | 'adverb' | 'phrase' | 'idiom'
export type WordLevel = 'Básico' | 'Intermediário' | 'Avançado' | 'Técnico'

export interface Word {
  id?: number
  word: string
  phonetic: string | null
  pos: PartOfSpeech | null
  level: WordLevel | null
  meaning_pt: string
  meaning_en: string | null
  examples: WordExample[]
  synonyms: string[]
  contexts: string[]
  created_at?: string
  last_viewed?: string
  view_count?: number
  is_saved?: 0 | 1
}

// O que a Claude API devolve (antes de entrar no DB)
export type ClaudeWordResponse = Omit<Word, 'id' | 'created_at' | 'last_viewed' | 'view_count' | 'is_saved'>

// API IPC exposta ao renderer via contextBridge
export interface LexioAPI {
  getWord:        (word: string)              => Promise<Word | null>
  saveWord:       (data: ClaudeWordResponse)  => Promise<Word>
  toggleSaved:    (word: string)              => Promise<Word>
  deleteWord:     (word: string)              => Promise<void>
  getHistory:     (limit?: number)            => Promise<Word[]>
  getSaved:       ()                          => Promise<Word[]>
  closeWindow:    ()                          => void
  minimizeWindow: ()                          => void
}

// Augment global window para o renderer reconhecer window.lexio
declare global {
  interface Window {
    lexio: LexioAPI
  }
}



