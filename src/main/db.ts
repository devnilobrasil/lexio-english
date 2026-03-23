// src/main/db.ts
import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import type { Word, ClaudeWordResponse } from '../types'

// Linha raw do SQLite (campos JSON ainda como string)
interface WordRow extends Omit<Word, 'examples' | 'synonyms' | 'contexts'> {
  examples: string
  synonyms: string
  contexts: string
}

let db: Database.Database

export function init(): void {
  // O ficheiro .db vive em userData do sistema operativo
  const dbPath = path.join(app.getPath('userData'), 'lexio.db')
  db = new Database(dbPath)
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      word        TEXT NOT NULL UNIQUE COLLATE NOCASE,
      phonetic    TEXT,
      pos         TEXT,
      level       TEXT,
      meaning_pt  TEXT NOT NULL,
      meaning_en  TEXT,
      examples    TEXT,
      synonyms    TEXT,
      contexts    TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      last_viewed TEXT DEFAULT (datetime('now')),
      view_count  INTEGER DEFAULT 1,
      is_saved    INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_word    ON words(word);
    CREATE INDEX IF NOT EXISTS idx_saved   ON words(is_saved);
    CREATE INDEX IF NOT EXISTS idx_created ON words(created_at DESC);
  `)
}

export function getWord(word: string): Word | null {
  const row = db.prepare('SELECT * FROM words WHERE word = ?').get(word) as WordRow | undefined
  if (!row) return null
  
  db.prepare(
    `UPDATE words SET view_count = view_count + 1, last_viewed = datetime('now') WHERE word = ?`
  ).run(word)
  
  return deserialize(row)
}

export function upsertWord(data: ClaudeWordResponse): Word {
  db.prepare(`
    INSERT INTO words (word, phonetic, pos, level, meaning_pt, meaning_en, examples, synonyms, contexts)
    VALUES (@word, @phonetic, @pos, @level, @meaning_pt, @meaning_en, @examples, @synonyms, @contexts)
    ON CONFLICT(word) DO UPDATE SET
      phonetic    = excluded.phonetic,
      pos         = excluded.pos,
      level       = excluded.level,
      meaning_pt  = excluded.meaning_pt,
      meaning_en  = excluded.meaning_en,
      examples    = excluded.examples,
      synonyms    = excluded.synonyms,
      contexts    = excluded.contexts,
      last_viewed = datetime('now'),
      view_count  = view_count + 1
  `).run(serialize(data))
  
  return getWord(data.word)!
}

export function toggleSaved(word: string): Word {
  db.prepare(
    `UPDATE words SET is_saved = CASE WHEN is_saved = 1 THEN 0 ELSE 1 END WHERE word = ?`
  ).run(word)
  return getWord(word)!
}

export function deleteWord(word: string): void {
  db.prepare('DELETE FROM words WHERE word = ?').run(word)
}

export function getHistory(limit = 30): Word[] {
  return (
    db.prepare('SELECT * FROM words ORDER BY last_viewed DESC LIMIT ?').all(limit) as WordRow[]
  ).map(deserialize)
}

export function getSaved(): Word[] {
  return (
    db.prepare('SELECT * FROM words WHERE is_saved = 1 ORDER BY word ASC').all() as WordRow[]
  ).map(deserialize)
}

function serialize(data: ClaudeWordResponse) {
  return {
    ...data,
    examples: JSON.stringify(data.examples ?? []),
    synonyms: JSON.stringify(data.synonyms ?? []),
    contexts: JSON.stringify(data.contexts ?? []),
  }
}

function deserialize(row: WordRow): Word {
  return {
    ...row,
    examples: JSON.parse(row.examples ?? '[]'),
    synonyms: JSON.parse(row.synonyms ?? '[]'),
    contexts: JSON.parse(row.contexts ?? '[]'),
  }
}
