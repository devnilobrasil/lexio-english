// src/main/db.ts
import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import type { Word, AIWordResponse, Locale, PartOfSpeech, WordLevel } from '../types'

// Row raw do SQLite após JOIN com word_translations
interface WordRow {
  id: number
  word: string
  phonetic: string | null
  pos: string | null
  level: string | null
  verb_forms: string | null
  meaning_en: string | null
  synonyms: string
  antonyms: string
  contexts: string
  created_at: string
  last_viewed: string
  view_count: number
  is_saved: 0 | 1
  // Campos do JOIN
  meaning: string | null
  trans_examples: string | null
  trans_locale: string | null
  trans_tip: string | null
}

let db: Database.Database

export function init(): void {
  const dbPath = path.join(app.getPath('userData'), 'lexio.db')
  db = new Database(dbPath)
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      word        TEXT NOT NULL UNIQUE COLLATE NOCASE,
      phonetic    TEXT,
      pos         TEXT,
      level       TEXT,
      synonyms    TEXT,
      contexts    TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      last_viewed TEXT DEFAULT (datetime('now')),
      view_count  INTEGER DEFAULT 1,
      is_saved    INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS word_translations (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      word     TEXT NOT NULL COLLATE NOCASE,
      locale   TEXT NOT NULL,
      meaning  TEXT NOT NULL,
      examples TEXT,
      FOREIGN KEY (word) REFERENCES words(word) ON DELETE CASCADE,
      UNIQUE (word, locale)
    );

    CREATE INDEX IF NOT EXISTS idx_word    ON words(word);
    CREATE INDEX IF NOT EXISTS idx_saved   ON words(is_saved);
    CREATE INDEX IF NOT EXISTS idx_created ON words(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_trans   ON word_translations(word, locale);
  `)

  // Migração: adicionar coluna in_history se não existir
  const allCols = db.pragma('table_info(words)') as { name: string }[]
  if (!allCols.some(c => c.name === 'in_history')) {
    db.exec(`ALTER TABLE words ADD COLUMN in_history INTEGER DEFAULT 1`)
  }
  if (!allCols.some(c => c.name === 'verb_forms')) {
    db.exec(`ALTER TABLE words ADD COLUMN verb_forms TEXT`)
  }
  if (!allCols.some(c => c.name === 'meaning_en')) {
    db.exec(`ALTER TABLE words ADD COLUMN meaning_en TEXT`)
  }
  if (!allCols.some(c => c.name === 'antonyms')) {
    db.exec(`ALTER TABLE words ADD COLUMN antonyms TEXT DEFAULT '[]'`)
  }

  const transCols = db.pragma('table_info(word_translations)') as { name: string }[]
  if (!transCols.some(c => c.name === 'tip')) {
    db.exec(`ALTER TABLE word_translations ADD COLUMN tip TEXT`)
  }

  // Migração: mover meaning_pt / meaning_en / examples para word_translations
  const cols = allCols
  const hasMeaningPt = cols.some(c => c.name === 'meaning_pt')

  if (hasMeaningPt) {
    db.exec(`
      INSERT OR IGNORE INTO word_translations (word, locale, meaning, examples)
      SELECT word, 'pt-BR', meaning_pt, examples FROM words WHERE meaning_pt IS NOT NULL;

      UPDATE words SET level = 'Basic'        WHERE level = 'Básico';
      UPDATE words SET level = 'Intermediate' WHERE level = 'Intermediário';
      UPDATE words SET level = 'Advanced'     WHERE level = 'Avançado';
      UPDATE words SET level = 'Technical'    WHERE level = 'Técnico';

      ALTER TABLE words DROP COLUMN meaning_pt;
      ALTER TABLE words DROP COLUMN meaning_en;
      ALTER TABLE words DROP COLUMN examples;
    `)
  }
}

export function getWord(word: string, locale: Locale): Word | null {
  const row = db.prepare(`
    SELECT w.*, wt.meaning, wt.examples AS trans_examples, wt.locale AS trans_locale, wt.tip AS trans_tip
    FROM words w
    LEFT JOIN word_translations wt ON wt.word = w.word AND wt.locale = ?
    WHERE w.word = ? COLLATE NOCASE
  `).get(locale, word) as WordRow | undefined

  if (!row || !row.meaning) return null

  db.prepare(
    `UPDATE words SET view_count = view_count + 1, last_viewed = datetime('now') WHERE word = ?`
  ).run(word)

  return deserialize(row)
}

export function upsertWord(data: AIWordResponse, locale: Locale): Word {
  db.prepare(`
    INSERT INTO words (word, phonetic, pos, level, verb_forms, meaning_en, synonyms, antonyms, contexts)
    VALUES (@word, @phonetic, @pos, @level, @verb_forms, @meaning_en, @synonyms, @antonyms, @contexts)
    ON CONFLICT(word) DO UPDATE SET
      phonetic    = excluded.phonetic,
      pos         = excluded.pos,
      level       = excluded.level,
      verb_forms  = excluded.verb_forms,
      meaning_en  = excluded.meaning_en,
      synonyms    = excluded.synonyms,
      antonyms    = excluded.antonyms,
      contexts    = excluded.contexts,
      last_viewed = datetime('now'),
      view_count  = view_count + 1
  `).run({
    word:       data.word,
    phonetic:   data.phonetic,
    pos:        data.pos,
    level:      data.level,
    verb_forms: data.verb_forms ? JSON.stringify(data.verb_forms) : null,
    meaning_en: data.meaning_en ?? '',
    synonyms:   JSON.stringify(data.synonyms ?? []),
    antonyms:   JSON.stringify(data.antonyms ?? []),
    contexts:   JSON.stringify(data.contexts ?? []),
  })

  db.prepare(`
    INSERT INTO word_translations (word, locale, meaning, examples, tip)
    VALUES (@word, @locale, @meaning, @examples, @tip)
    ON CONFLICT(word, locale) DO UPDATE SET
      meaning  = excluded.meaning,
      examples = excluded.examples,
      tip      = excluded.tip
  `).run({
    word:     data.word,
    locale,
    meaning:  data.meaning,
    examples: JSON.stringify(data.examples ?? []),
    tip:      data.tip ?? '',
  })

  return getWord(data.word, locale)!
}

export function toggleSaved(word: string): Word {
  // toggleSaved não tem locale — retorna o word com pt-BR por padrão para o hook de search
  db.prepare(
    `UPDATE words SET is_saved = CASE WHEN is_saved = 1 THEN 0 ELSE 1 END WHERE word = ?`
  ).run(word)

  // Busca com qualquer tradução disponível
  const row = db.prepare(`
    SELECT w.*, wt.meaning, wt.examples AS trans_examples, wt.locale AS trans_locale, wt.tip AS trans_tip
    FROM words w
    LEFT JOIN word_translations wt ON wt.word = w.word
    WHERE w.word = ?
    ORDER BY wt.locale ASC
    LIMIT 1
  `).get(word) as WordRow | undefined

  return deserialize(row!)
}

export function deleteWord(word: string): void {
  db.prepare('DELETE FROM words WHERE word = ?').run(word)
}

export function removeFromHistory(word: string): void {
  db.prepare('UPDATE words SET in_history = 0 WHERE word = ?').run(word)
}

export function unsaveWord(word: string): void {
  db.prepare('UPDATE words SET is_saved = 0 WHERE word = ?').run(word)
}

export function getHistory(limit = 30, locale: Locale): Word[] {
  const safeLimit = Math.max(1, Math.floor(Number(limit) || 30))
  return (
    db.prepare(`
      SELECT w.*, wt.meaning, wt.examples AS trans_examples, wt.locale AS trans_locale, wt.tip AS trans_tip
      FROM words w
      LEFT JOIN word_translations wt ON wt.word = w.word AND wt.locale = ?
      WHERE w.in_history = 1
      ORDER BY w.last_viewed DESC LIMIT ${safeLimit}
    `).all(locale) as WordRow[]
  ).map(deserialize)
}

export function getSaved(locale: Locale): Word[] {
  return (
    db.prepare(`
      SELECT w.*, wt.meaning, wt.examples AS trans_examples, wt.locale AS trans_locale, wt.tip AS trans_tip
      FROM words w
      LEFT JOIN word_translations wt ON wt.word = w.word AND wt.locale = ?
      WHERE w.is_saved = 1
      ORDER BY w.word ASC
    `).all(locale) as WordRow[]
  ).map(deserialize)
}

function deserialize(row: WordRow): Word {
  return {
    id:         row.id,
    word:       row.word,
    phonetic:   row.phonetic,
    pos:        row.pos as PartOfSpeech | null,
    level:      row.level as WordLevel | null,
    verb_forms: row.verb_forms ? JSON.parse(row.verb_forms) : null,
    meaning_en: row.meaning_en ?? '',
    synonyms:   JSON.parse(row.synonyms ?? '[]'),
    antonyms:   JSON.parse(row.antonyms ?? '[]'),
    contexts:   JSON.parse(row.contexts ?? '[]'),
    translation: {
      locale:   (row.trans_locale ?? 'pt-BR') as Locale,
      meaning:  row.meaning ?? '',
      examples: JSON.parse(row.trans_examples ?? '[]'),
      tip:      row.trans_tip ?? '',
    },
    created_at:  row.created_at,
    last_viewed: row.last_viewed,
    view_count:  row.view_count,
    is_saved:    row.is_saved,
  }
}
