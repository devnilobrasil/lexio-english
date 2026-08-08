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

export type AssistantState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'no-selection'
  | 'english-text'

export interface TranslationResponse {
  original: string
  translation: string
}

export interface AssistantTextReadyPayload {
  text: string
}

