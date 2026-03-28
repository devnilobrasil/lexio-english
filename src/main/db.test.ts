// src/main/db.test.ts
import { vi, describe, it, expect, beforeAll, afterEach } from 'vitest'
import os from 'os'
import type { AIWordResponse } from '../types'

vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir() },
}))

import * as db from './db'

const LOCALE = 'pt-BR' as const

function makeWord(word: string, overrides: Partial<AIWordResponse> = {}): AIWordResponse {
  return {
    word,
    phonetic: `/${word}/`,
    pos: 'noun',
    level: 'Basic',
    verb_forms: null,
    meanings: [
      {
        context: 'General',
        meaning_en: `English meaning of ${word}`,
        meaning_short: `Short meaning of ${word}`,
        meaning: `Meaning of ${word}`,
        examples: [{ en: `${word} example.`, translation: `Exemplo de ${word}.` }],
      },
    ],
    synonyms: ['syn1', 'syn2'],
    antonyms: [],
    contexts: ['ctx1'],
    ...overrides,
  }
}

beforeAll(() => {
  db.init()
})

// ---------------------------------------------------------------------------
// getWord
// ---------------------------------------------------------------------------
describe('getWord', () => {
  afterEach(() => { try { db.deleteWord('serendipity') } catch { /* no-op */ } })

  it('returns null for a word that does not exist', () => {
    expect(db.getWord('nonexistent_xyz', LOCALE)).toBeNull()
  })

  it('returns the correct word when found', () => {
    db.upsertWord(makeWord('serendipity'), LOCALE)
    const result = db.getWord('serendipity', LOCALE)
    expect(result).not.toBeNull()
    expect(result!.word).toBe('serendipity')
    expect(result!.meanings[0].meaning).toBe('Meaning of serendipity')
    expect(result!.synonyms).toEqual(['syn1', 'syn2'])
    expect(result!.meanings[0].examples).toHaveLength(1)
  })

  it('increments view_count on each call', () => {
    db.upsertWord(makeWord('serendipity'), LOCALE)
    const first = db.getWord('serendipity', LOCALE)!
    const second = db.getWord('serendipity', LOCALE)!
    expect(second.view_count!).toBeGreaterThan(first.view_count!)
  })

  it('returns null when the word exists but has no translation for the requested locale', () => {
    db.upsertWord(makeWord('serendipity'), LOCALE)
    expect(db.getWord('serendipity', 'es')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// upsertWord
// ---------------------------------------------------------------------------
describe('upsertWord', () => {
  afterEach(() => { try { db.deleteWord('ponder') } catch { /* no-op */ } })

  it('inserts a new word with all fields correctly', () => {
    const word = db.upsertWord(makeWord('ponder'), LOCALE)
    expect(word.word).toBe('ponder')
    expect(word.synonyms).toEqual(['syn1', 'syn2'])
    expect(word.contexts).toEqual(['ctx1'])
    expect(word.meanings).toHaveLength(1)
    expect(word.meanings[0].examples).toHaveLength(1)
    expect(word.is_saved).toBe(0)
  })

  it('updates meanings when the word already exists', () => {
    db.upsertWord(makeWord('ponder'), LOCALE)
    const newMeanings = [{ context: 'Updated', meaning_en: 'Updated en', meaning_short: 'Updated short', meaning: 'Updated meaning', examples: [] }]
    const updated = db.upsertWord(makeWord('ponder', { meanings: newMeanings }), LOCALE)
    expect(updated.meanings[0].meaning).toBe('Updated meaning')
  })

  it('does not reset is_saved on update', () => {
    db.upsertWord(makeWord('ponder'), LOCALE)
    db.toggleSaved('ponder')
    const newMeanings = [{ context: 'General', meaning_en: 'Again en', meaning_short: 'Again short', meaning: 'Again', examples: [] }]
    const updated = db.upsertWord(makeWord('ponder', { meanings: newMeanings }), LOCALE)
    expect(updated.is_saved).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// toggleSaved
// ---------------------------------------------------------------------------
describe('toggleSaved', () => {
  afterEach(() => { try { db.deleteWord('cogitate') } catch { /* no-op */ } })

  it('sets is_saved to 1 on first toggle', () => {
    db.upsertWord(makeWord('cogitate'), LOCALE)
    const result = db.toggleSaved('cogitate')
    expect(result.is_saved).toBe(1)
  })

  it('sets is_saved back to 0 on second toggle', () => {
    db.upsertWord(makeWord('cogitate'), LOCALE)
    db.toggleSaved('cogitate')
    const result = db.toggleSaved('cogitate')
    expect(result.is_saved).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// deleteWord
// ---------------------------------------------------------------------------
describe('deleteWord', () => {
  it('removes the word entirely from the database', () => {
    db.upsertWord(makeWord('transient'), LOCALE)
    db.deleteWord('transient')
    expect(db.getWord('transient', LOCALE)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getHistory
// ---------------------------------------------------------------------------
describe('getHistory', () => {
  afterEach(() => {
    try { db.deleteWord('luminous') } catch { /* no-op */ }
    try { db.deleteWord('obscure') } catch { /* no-op */ }
  })

  it('includes words with in_history = 1 (default)', () => {
    db.upsertWord(makeWord('luminous'), LOCALE)
    const history = db.getHistory(50, LOCALE)
    expect(history.some(w => w.word === 'luminous')).toBe(true)
  })

  it('excludes words with in_history = 0', () => {
    db.upsertWord(makeWord('obscure'), LOCALE)
    db.removeFromHistory('obscure')
    const history = db.getHistory(50, LOCALE)
    expect(history.some(w => w.word === 'obscure')).toBe(false)
  })

  it('respects the limit parameter', () => {
    db.upsertWord(makeWord('luminous'), LOCALE)
    const history = db.getHistory(1, LOCALE)
    expect(history.length).toBeLessThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// getSaved
// ---------------------------------------------------------------------------
describe('getSaved', () => {
  afterEach(() => {
    try { db.deleteWord('felicity') } catch { /* no-op */ }
    try { db.deleteWord('melancholy') } catch { /* no-op */ }
  })

  it('includes words with is_saved = 1', () => {
    db.upsertWord(makeWord('felicity'), LOCALE)
    db.toggleSaved('felicity')
    const saved = db.getSaved(LOCALE)
    expect(saved.some(w => w.word === 'felicity')).toBe(true)
  })

  it('excludes words with is_saved = 0 (default)', () => {
    db.upsertWord(makeWord('melancholy'), LOCALE)
    const saved = db.getSaved(LOCALE)
    expect(saved.some(w => w.word === 'melancholy')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// removeFromHistory — função nova
// ---------------------------------------------------------------------------
describe('removeFromHistory', () => {
  afterEach(() => { try { db.deleteWord('ethereal') } catch { /* no-op */ } })

  it('removes the word from getHistory', () => {
    db.upsertWord(makeWord('ethereal'), LOCALE)
    db.removeFromHistory('ethereal')
    const history = db.getHistory(50, LOCALE)
    expect(history.some(w => w.word === 'ethereal')).toBe(false)
  })

  it('does NOT delete the word from the database', () => {
    db.upsertWord(makeWord('ethereal'), LOCALE)
    db.removeFromHistory('ethereal')
    expect(db.getWord('ethereal', LOCALE)).not.toBeNull()
  })

  it('does NOT remove the word from getSaved', () => {
    db.upsertWord(makeWord('ethereal'), LOCALE)
    db.toggleSaved('ethereal')
    db.removeFromHistory('ethereal')
    const saved = db.getSaved(LOCALE)
    expect(saved.some(w => w.word === 'ethereal')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Novos campos: verb_forms, meanings, antonyms
// ---------------------------------------------------------------------------
describe('novos campos — persistência', () => {
  afterEach(() => { try { db.deleteWord('scrutinize') } catch { /* no-op */ } })

  const VERB_FORMS = {
    infinitive: 'to scrutinize',
    past: 'scrutinized',
    past_participle: 'scrutinized',
    present_participle: 'scrutinizing',
    third_person: 'scrutinizes',
  }

  it('salva e recupera verb_forms como JSON', () => {
    db.upsertWord(makeWord('scrutinize', { pos: 'verb', verb_forms: VERB_FORMS }), LOCALE)
    const result = db.getWord('scrutinize', LOCALE)!
    expect(result.verb_forms).toEqual(VERB_FORMS)
  })

  it('salva verb_forms null para não-verbos', () => {
    db.upsertWord(makeWord('scrutinize', { pos: 'noun', verb_forms: null }), LOCALE)
    const result = db.getWord('scrutinize', LOCALE)!
    expect(result.verb_forms).toBeNull()
  })

  it('salva e recupera meanings com meaning_en dentro de cada entrada', () => {
    const meanings = [{
      context: 'Formal',
      meaning_en: 'To examine closely and critically.',
      meaning_short: 'Examinar de perto e criticamente.',
      meaning: 'Olhar algo com muita atenção, procurando detalhes ou falhas.',
      examples: [{ en: 'She scrutinized the contract.', translation: 'Ela examinou o contrato.' }],
    }]
    db.upsertWord(makeWord('scrutinize', { meanings }), LOCALE)
    const result = db.getWord('scrutinize', LOCALE)!
    expect(result.meanings[0].meaning_en).toBe('To examine closely and critically.')
    expect(result.meanings[0].context).toBe('Formal')
  })

  it('salva e recupera antonyms como JSON', () => {
    db.upsertWord(makeWord('scrutinize', { antonyms: ['ignore', 'overlook'] }), LOCALE)
    const result = db.getWord('scrutinize', LOCALE)!
    expect(result.antonyms).toEqual(['ignore', 'overlook'])
  })

  it('retorna array vazio para antonyms quando não fornecido', () => {
    db.upsertWord(makeWord('scrutinize', { antonyms: [] }), LOCALE)
    const result = db.getWord('scrutinize', LOCALE)!
    expect(result.antonyms).toEqual([])
  })

  it('meanings é locale-específico', () => {
    const ptMeanings = [{ context: 'General', meaning_en: 'To examine', meaning_short: 'Examinar', meaning: 'Olhar com atenção', examples: [] }]
    const esMeanings = [{ context: 'General', meaning_en: 'To examine', meaning_short: 'Examinar', meaning: 'Mirar con atención', examples: [] }]
    db.upsertWord(makeWord('scrutinize', { meanings: ptMeanings }), 'pt-BR')
    db.upsertWord(makeWord('scrutinize', { meanings: esMeanings }), 'es')
    expect(db.getWord('scrutinize', 'pt-BR')!.meanings[0].meaning).toBe('Olhar com atenção')
    expect(db.getWord('scrutinize', 'es')!.meanings[0].meaning).toBe('Mirar con atención')
  })

  it('upsert atualiza meanings e antonyms ao fazer conflito', () => {
    db.upsertWord(makeWord('scrutinize', { antonyms: ['a'] }), LOCALE)
    const newMeanings = [{ context: 'Updated', meaning_en: 'Updated', meaning_short: 'Atualizado', meaning: 'Atualizado', examples: [] }]
    db.upsertWord(makeWord('scrutinize', { meanings: newMeanings, antonyms: ['b', 'c'] }), LOCALE)
    const result = db.getWord('scrutinize', LOCALE)!
    expect(result.meanings[0].meaning_en).toBe('Updated')
    expect(result.antonyms).toEqual(['b', 'c'])
  })
})

// ---------------------------------------------------------------------------
// Novos campos — getHistory e getSaved incluem meanings via JOIN
// ---------------------------------------------------------------------------
describe('novos campos — listas (getHistory / getSaved)', () => {
  afterEach(() => { try { db.deleteWord('ephemeral') } catch { /* no-op */ } })

  it('getHistory retorna meanings corretamente via JOIN', () => {
    db.upsertWord(makeWord('ephemeral'), LOCALE)
    const history = db.getHistory(50, LOCALE)
    const found = history.find(w => w.word === 'ephemeral')
    expect(found).toBeDefined()
    expect(found!.meanings).toHaveLength(1)
    expect(found!.meanings[0].meaning).toBe('Meaning of ephemeral')
  })

  it('getSaved retorna meanings corretamente via JOIN', () => {
    db.upsertWord(makeWord('ephemeral'), LOCALE)
    db.toggleSaved('ephemeral')
    const saved = db.getSaved(LOCALE)
    const found = saved.find(w => w.word === 'ephemeral')
    expect(found).toBeDefined()
    expect(found!.meanings).toHaveLength(1)
  })

  it('getHistory retorna antonyms corretamente', () => {
    db.upsertWord(makeWord('ephemeral', { antonyms: ['permanent', 'eternal'] }), LOCALE)
    const history = db.getHistory(50, LOCALE)
    const found = history.find(w => w.word === 'ephemeral')
    expect(found!.antonyms).toEqual(['permanent', 'eternal'])
  })
})

// ---------------------------------------------------------------------------
// Compatibilidade retroativa — campos ausentes retornam defaults seguros
// ---------------------------------------------------------------------------
describe('compatibilidade retroativa — defaults seguros', () => {
  afterEach(() => { try { db.deleteWord('legacy') } catch { /* no-op */ } })

  it('retorna null para verb_forms ausente', () => {
    db.upsertWord(makeWord('legacy', { verb_forms: null }), LOCALE)
    expect(db.getWord('legacy', LOCALE)!.verb_forms).toBeNull()
  })

  it('retorna array vazio para antonyms ausente', () => {
    db.upsertWord(makeWord('legacy', { antonyms: [] }), LOCALE)
    expect(db.getWord('legacy', LOCALE)!.antonyms).toEqual([])
  })

  it('retorna meanings com array vazio de examples', () => {
    const meanings = [{ context: 'General', meaning_en: 'Test', meaning_short: 'Teste', meaning: 'Teste', examples: [] }]
    db.upsertWord(makeWord('legacy', { meanings }), LOCALE)
    expect(db.getWord('legacy', LOCALE)!.meanings[0].examples).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// unsaveWord — função nova
// ---------------------------------------------------------------------------
describe('unsaveWord', () => {
  afterEach(() => { try { db.deleteWord('reverie') } catch { /* no-op */ } })

  it('removes the word from getSaved', () => {
    db.upsertWord(makeWord('reverie'), LOCALE)
    db.toggleSaved('reverie')
    db.unsaveWord('reverie')
    const saved = db.getSaved(LOCALE)
    expect(saved.some(w => w.word === 'reverie')).toBe(false)
  })

  it('does NOT delete the word from the database', () => {
    db.upsertWord(makeWord('reverie'), LOCALE)
    db.toggleSaved('reverie')
    db.unsaveWord('reverie')
    expect(db.getWord('reverie', LOCALE)).not.toBeNull()
  })

  it('does NOT remove the word from getHistory', () => {
    db.upsertWord(makeWord('reverie'), LOCALE)
    db.toggleSaved('reverie')
    db.unsaveWord('reverie')
    const history = db.getHistory(50, LOCALE)
    expect(history.some(w => w.word === 'reverie')).toBe(true)
  })
})
