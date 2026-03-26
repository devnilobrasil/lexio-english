// src/main/db.test.ts
import { vi, describe, it, expect, beforeAll, afterEach } from 'vitest'
import os from 'os'
import type { AIWordResponse } from '../../types'

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
    synonyms: ['syn1', 'syn2'],
    contexts: ['ctx1'],
    meaning: `Meaning of ${word}`,
    examples: [{ en: `${word} example.`, translation: `Exemplo de ${word}.` }],
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
    expect(result!.translation.meaning).toBe('Meaning of serendipity')
    expect(result!.synonyms).toEqual(['syn1', 'syn2'])
    expect(result!.translation.examples).toHaveLength(1)
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
    expect(word.translation.locale).toBe(LOCALE)
    expect(word.translation.examples).toHaveLength(1)
    expect(word.is_saved).toBe(0)
  })

  it('updates meaning when the word already exists', () => {
    db.upsertWord(makeWord('ponder'), LOCALE)
    const updated = db.upsertWord(makeWord('ponder', { meaning: 'Updated meaning' }), LOCALE)
    expect(updated.translation.meaning).toBe('Updated meaning')
  })

  it('does not reset is_saved on update', () => {
    db.upsertWord(makeWord('ponder'), LOCALE)
    db.toggleSaved('ponder')
    const updated = db.upsertWord(makeWord('ponder', { meaning: 'Again' }), LOCALE)
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
