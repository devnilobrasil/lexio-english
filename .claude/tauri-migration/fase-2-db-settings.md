# Fase 2 — Backend Rust: DB + Settings

**Objetivo:** Implementar toda a camada de banco de dados em Rust com `rusqlite`, replicando exatamente o schema e comportamento do `db.ts` atual. Registrar os commands síncronos de palavra e settings. Validar com testes unitários em memória.

**Referência:** `SPEC.md` — Seções 4, 5 e 12

---

## Skills e Modelo

**Modelo recomendado:** `claude-opus-4-6`
Esta fase envolve Rust com lifetimes, `Mutex`, `rusqlite`, serde e TDD completo. Erros aqui se propagam para todas as fases seguintes. Usar Opus.

**Ler antes de implementar:**

| Skill | Por quê |
|---|---|
| `.claude/skills/rust-patterns/SKILL.md` | `AppState`, `Mutex<Connection>`, `Result<T,String>`, serde, módulos |
| `.claude/skills/sqlite-patterns/SKILL.md` | Referência: schema atual, padrões JSON (portar de Node para Rust) |
| `superpowers:test-driven-development` | Escrever testes Rust (`#[cfg(test)]`) antes de cada função de DB |
| `superpowers:systematic-debugging` | Resolver erros de borrow checker e compilation Rust |

---

## Pré-requisitos

- Fase 1 concluída (projeto Tauri compilando)
- Schema atual do SQLite documentado em `db.ts` (lido antes de começar)

---

## Dependências a Adicionar em `Cargo.toml`

```toml
[dependencies]
rusqlite = { version = "0.31", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
tauri = { version = "2", features = ["tray-icon", "image-ico", "image-png"] }
```

---

## Estrutura de Arquivos

```
src/tauri/src/
├── main.rs          ← registrar commands + AppState
├── state.rs         ← NOVO: AppState struct
├── db/
│   ├── mod.rs       ← NOVO: init, migrations, schema
│   ├── words.rs     ← NOVO: get_word, upsert_word, toggle_saved, etc.
│   └── settings.rs  ← NOVO: get_api_key, set_api_key
└── commands/
    ├── mod.rs       ← NOVO: re-exports
    └── words.rs     ← NOVO: Tauri commands que delegam para db/
```

---

## Passo 1 — AppState (`src/tauri/src/state.rs`)

```rust
use rusqlite::Connection;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
}

impl AppState {
    pub fn new(conn: Connection) -> Self {
        AppState {
            db: Mutex::new(conn),
        }
    }
}
```

---

## Passo 2 — Tipos (`src/tauri/src/types.rs`)

Replicar `src/types/index.ts` como structs Rust com serde:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WordExample {
    pub en: String,
    pub translation: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VerbForms {
    pub infinitive: String,
    pub past: String,
    pub past_participle: String,
    pub present_participle: String,
    pub third_person: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MeaningEntry {
    pub context: String,
    pub meaning_en: String,
    pub meaning_short: String,
    pub meaning: String,
    pub examples: Vec<WordExample>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Word {
    pub id: Option<i64>,
    pub word: String,
    pub phonetic: Option<String>,
    pub pos: Option<String>,
    pub level: Option<String>,
    pub verb_forms: Option<VerbForms>,
    pub meanings: Vec<MeaningEntry>,
    pub synonyms: Vec<String>,
    pub antonyms: Vec<String>,
    pub contexts: Vec<String>,
    pub created_at: Option<String>,
    pub last_viewed: Option<String>,
    pub view_count: Option<i64>,
    pub is_saved: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AIWordResponse {
    pub word: String,
    pub phonetic: Option<String>,
    pub pos: Option<String>,
    pub level: Option<String>,
    pub verb_forms: Option<VerbForms>,
    pub meanings: Vec<MeaningEntry>,
    pub synonyms: Vec<String>,
    pub antonyms: Vec<String>,
    pub contexts: Vec<String>,
}
```

---

## Passo 3 — Schema e Migrations (`src/tauri/src/db/mod.rs`)

Replicar exatamente o `init()` do `db.ts`:

```rust
use rusqlite::{Connection, Result};
use tauri::Manager;

pub fn init(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    conn.execute_batch("
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

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    ")?;

    run_migrations(conn)?;

    Ok(())
}

fn run_migrations(conn: &Connection) -> Result<()> {
    // Colunas em words
    let word_cols = get_columns(conn, "words")?;

    if !word_cols.contains(&"in_history".to_string()) {
        conn.execute_batch("ALTER TABLE words ADD COLUMN in_history INTEGER DEFAULT 1")?;
    }
    if !word_cols.contains(&"verb_forms".to_string()) {
        conn.execute_batch("ALTER TABLE words ADD COLUMN verb_forms TEXT")?;
    }
    if !word_cols.contains(&"antonyms".to_string()) {
        conn.execute_batch("ALTER TABLE words ADD COLUMN antonyms TEXT DEFAULT '[]'")?;
    }

    // Colunas em word_translations
    let trans_cols = get_columns(conn, "word_translations")?;

    if !trans_cols.contains(&"meaning_short".to_string()) {
        conn.execute_batch("ALTER TABLE word_translations ADD COLUMN meaning_short TEXT")?;
    }
    if !trans_cols.contains(&"meanings".to_string()) {
        conn.execute_batch("ALTER TABLE word_translations ADD COLUMN meanings TEXT")?;
        // Migrar dados antigos: montar meanings array a partir dos campos flat
        migrate_old_meanings(conn)?;
    }

    Ok(())
}

fn get_columns(conn: &Connection, table: &str) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
    let cols = stmt.query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>>>()?;
    Ok(cols)
}

fn migrate_old_meanings(conn: &Connection) -> Result<()> {
    // Replicar a migration do db.ts: rows com meaning IS NOT NULL e meanings IS NULL
    // Construir meanings JSON array a partir do meaning flat
    let rows: Vec<(String, String, String)> = {
        let mut stmt = conn.prepare(
            "SELECT word, locale, meaning FROM word_translations WHERE meanings IS NULL AND meaning IS NOT NULL"
        )?;
        stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
        })?.collect::<Result<Vec<_>>>()?
    };

    for (word, locale, meaning) in rows {
        let entry = serde_json::json!([{
            "context": "General",
            "meaning_en": "",
            "meaning_short": "",
            "meaning": meaning,
            "examples": []
        }]);
        conn.execute(
            "UPDATE word_translations SET meanings = ?1 WHERE word = ?2 AND locale = ?3",
            (entry.to_string(), &word, &locale),
        )?;
    }

    Ok(())
}

pub fn get_db_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    app.path().app_data_dir()
        .expect("failed to get app data dir")
        .join("lexio.db")
}
```

---

## Passo 4 — Funções de Palavras (`src/tauri/src/db/words.rs`)

```rust
use rusqlite::{Connection, params};
use crate::types::{Word, AIWordResponse};

pub fn get_word(conn: &Connection, word: &str, locale: &str) -> rusqlite::Result<Option<Word>> {
    let mut stmt = conn.prepare("
        SELECT w.id, w.word, w.phonetic, w.pos, w.level, w.verb_forms,
               w.synonyms, w.antonyms, w.contexts,
               w.created_at, w.last_viewed, w.view_count, w.is_saved,
               wt.meanings
        FROM words w
        LEFT JOIN word_translations wt ON wt.word = w.word AND wt.locale = ?1
        WHERE w.word = ?2 COLLATE NOCASE
    ")?;

    let result = stmt.query_row(params![locale, word], |row| {
        let meanings_json: Option<String> = row.get(13)?;
        if meanings_json.is_none() {
            return Ok(None);
        }
        Ok(Some(row_to_word(row, meanings_json)?))
    });

    match result {
        Ok(word_opt) => {
            if word_opt.is_some() {
                conn.execute(
                    "UPDATE words SET view_count = view_count + 1, last_viewed = datetime('now') WHERE word = ?1",
                    params![word],
                )?;
            }
            Ok(word_opt)
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn upsert_word(conn: &Connection, data: &AIWordResponse, locale: &str) -> rusqlite::Result<Word> {
    conn.execute("
        INSERT INTO words (word, phonetic, pos, level, verb_forms, synonyms, antonyms, contexts)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ON CONFLICT(word) DO UPDATE SET
            phonetic    = excluded.phonetic,
            pos         = excluded.pos,
            level       = excluded.level,
            verb_forms  = excluded.verb_forms,
            synonyms    = excluded.synonyms,
            antonyms    = excluded.antonyms,
            contexts    = excluded.contexts,
            last_viewed = datetime('now'),
            view_count  = view_count + 1
    ", params![
        data.word,
        data.phonetic,
        data.pos,
        data.level,
        data.verb_forms.as_ref().map(|v| serde_json::to_string(v).unwrap()),
        serde_json::to_string(&data.synonyms).unwrap(),
        serde_json::to_string(&data.antonyms).unwrap(),
        serde_json::to_string(&data.contexts).unwrap(),
    ])?;

    let first_meaning = data.meanings.first().map(|m| m.meaning.clone()).unwrap_or_default();
    conn.execute("
        INSERT INTO word_translations (word, locale, meaning, meanings)
        VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(word, locale) DO UPDATE SET
            meaning  = excluded.meaning,
            meanings = excluded.meanings
    ", params![
        data.word,
        locale,
        first_meaning,
        serde_json::to_string(&data.meanings).unwrap(),
    ])?;

    get_word(conn, &data.word, locale).map(|w| w.expect("word must exist after upsert"))
}

pub fn toggle_saved(conn: &Connection, word: &str) -> rusqlite::Result<Word> {
    conn.execute(
        "UPDATE words SET is_saved = CASE WHEN is_saved = 1 THEN 0 ELSE 1 END WHERE word = ?1",
        params![word],
    )?;
    // Busca com qualquer locale disponível
    let mut stmt = conn.prepare("
        SELECT w.id, w.word, w.phonetic, w.pos, w.level, w.verb_forms,
               w.synonyms, w.antonyms, w.contexts,
               w.created_at, w.last_viewed, w.view_count, w.is_saved,
               wt.meanings
        FROM words w
        LEFT JOIN word_translations wt ON wt.word = w.word
        WHERE w.word = ?1
        ORDER BY wt.locale ASC
        LIMIT 1
    ")?;
    stmt.query_row(params![word], |row| {
        let meanings_json: Option<String> = row.get(13)?;
        row_to_word(row, meanings_json)
    })
}

pub fn delete_word(conn: &Connection, word: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM words WHERE word = ?1", params![word])?;
    Ok(())
}

pub fn remove_from_history(conn: &Connection, word: &str) -> rusqlite::Result<()> {
    conn.execute("UPDATE words SET in_history = 0 WHERE word = ?1", params![word])?;
    Ok(())
}

pub fn unsave_word(conn: &Connection, word: &str) -> rusqlite::Result<()> {
    conn.execute("UPDATE words SET is_saved = 0 WHERE word = ?1", params![word])?;
    Ok(())
}

pub fn get_history(conn: &Connection, locale: &str, limit: u32) -> rusqlite::Result<Vec<Word>> {
    let safe_limit = limit.max(1).min(200);
    let mut stmt = conn.prepare(&format!("
        SELECT w.id, w.word, w.phonetic, w.pos, w.level, w.verb_forms,
               w.synonyms, w.antonyms, w.contexts,
               w.created_at, w.last_viewed, w.view_count, w.is_saved,
               wt.meanings
        FROM words w
        LEFT JOIN word_translations wt ON wt.word = w.word AND wt.locale = ?1
        WHERE w.in_history = 1
        ORDER BY w.last_viewed DESC LIMIT {}
    ", safe_limit))?;

    let rows = stmt.query_map(params![locale], |row| {
        let meanings_json: Option<String> = row.get(13)?;
        row_to_word(row, meanings_json)
    })?.collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(rows)
}

pub fn get_saved(conn: &Connection, locale: &str) -> rusqlite::Result<Vec<Word>> {
    let mut stmt = conn.prepare("
        SELECT w.id, w.word, w.phonetic, w.pos, w.level, w.verb_forms,
               w.synonyms, w.antonyms, w.contexts,
               w.created_at, w.last_viewed, w.view_count, w.is_saved,
               wt.meanings
        FROM words w
        LEFT JOIN word_translations wt ON wt.word = w.word AND wt.locale = ?1
        WHERE w.is_saved = 1
        ORDER BY w.word ASC
    ")?;

    let rows = stmt.query_map(params![locale], |row| {
        let meanings_json: Option<String> = row.get(13)?;
        row_to_word(row, meanings_json)
    })?.collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(rows)
}

// Helper: converte uma row do SELECT para Word
fn row_to_word(row: &rusqlite::Row, meanings_json: Option<String>) -> rusqlite::Result<Word> {
    let verb_forms_json: Option<String> = row.get(5)?;
    let synonyms_json: String = row.get::<_, Option<String>>(6)?.unwrap_or_else(|| "[]".to_string());
    let antonyms_json: String = row.get::<_, Option<String>>(7)?.unwrap_or_else(|| "[]".to_string());
    let contexts_json: String = row.get::<_, Option<String>>(8)?.unwrap_or_else(|| "[]".to_string());

    Ok(Word {
        id: row.get(0)?,
        word: row.get(1)?,
        phonetic: row.get(2)?,
        pos: row.get(3)?,
        level: row.get(4)?,
        verb_forms: verb_forms_json.and_then(|j| serde_json::from_str(&j).ok()),
        meanings: meanings_json.and_then(|j| serde_json::from_str(&j).ok()).unwrap_or_default(),
        synonyms: serde_json::from_str(&synonyms_json).unwrap_or_default(),
        antonyms: serde_json::from_str(&antonyms_json).unwrap_or_default(),
        contexts: serde_json::from_str(&contexts_json).unwrap_or_default(),
        created_at: row.get(9)?,
        last_viewed: row.get(10)?,
        view_count: row.get(11)?,
        is_saved: row.get(12)?,
    })
}
```

---

## Passo 5 — Settings (`src/tauri/src/db/settings.rs`)

```rust
use rusqlite::{Connection, params};

pub fn get_setting(conn: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    let result = conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get(0),
    );
    match result {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

pub fn get_api_key(conn: &Connection) -> rusqlite::Result<Option<String>> {
    get_setting(conn, "api_key")
}

pub fn set_api_key(conn: &Connection, key: &str) -> rusqlite::Result<()> {
    set_setting(conn, "api_key", key)
}
```

---

## Passo 6 — Commands Tauri (`src/tauri/src/commands/words.rs`)

```rust
use tauri::State;
use crate::state::AppState;
use crate::types::{Word, AIWordResponse};
use crate::db::{words as db_words, settings as db_settings};

#[tauri::command]
pub fn get_history(locale: String, limit: Option<u32>, state: State<'_, AppState>) -> Result<Vec<Word>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_words::get_history(&conn, &locale, limit.unwrap_or(30))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_saved(locale: String, state: State<'_, AppState>) -> Result<Vec<Word>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_words::get_saved(&conn, &locale)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_word(data: AIWordResponse, locale: String, state: State<'_, AppState>) -> Result<Word, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_words::upsert_word(&conn, &data, &locale)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_saved(word: String, state: State<'_, AppState>) -> Result<Word, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_words::toggle_saved(&conn, &word)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_word(word: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_words::delete_word(&conn, &word)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_from_history(word: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_words::remove_from_history(&conn, &word)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn unsave_word(word: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_words::unsave_word(&conn, &word)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_api_key(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_settings::get_api_key(&conn)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_api_key(key: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_settings::set_api_key(&conn, &key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}
```

---

## Passo 7 — Registrar no `main.rs`

```rust
mod state;
mod types;
mod db;
mod commands;

use rusqlite::Connection;
use state::AppState;
use db::mod::init as db_init;
use db::mod::get_db_path;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let db_path = get_db_path(app.handle());
            let conn = Connection::open(&db_path)
                .expect("failed to open database");
            db_init(&conn).expect("failed to initialize database");
            app.manage(AppState::new(conn));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::words::get_history,
            commands::words::get_saved,
            commands::words::save_word,
            commands::words::toggle_saved,
            commands::words::delete_word,
            commands::words::remove_from_history,
            commands::words::unsave_word,
            commands::words::get_api_key,
            commands::words::set_api_key,
            commands::words::get_app_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## Passo 8 — Testes Unitários (TDD)

Escrever ANTES de implementar cada função. Criar `src/tauri/src/db/tests.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use crate::db::mod::init;
    use crate::types::AIWordResponse;

    fn in_memory_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init(&conn).unwrap();
        conn
    }

    fn sample_word() -> AIWordResponse {
        AIWordResponse {
            word: "churn".to_string(),
            phonetic: Some("/tʃɜːrn/".to_string()),
            pos: Some("verb".to_string()),
            level: Some("Advanced".to_string()),
            verb_forms: None,
            meanings: vec![],
            synonyms: vec!["agitate".to_string()],
            antonyms: vec![],
            contexts: vec!["Business".to_string()],
        }
    }

    #[test]
    fn test_upsert_and_get_word() {
        let conn = in_memory_db();
        let data = sample_word();
        let saved = upsert_word(&conn, &data, "pt-BR").unwrap();
        assert_eq!(saved.word, "churn");

        let found = get_word(&conn, "churn", "pt-BR").unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().word, "churn");
    }

    #[test]
    fn test_get_word_case_insensitive() {
        let conn = in_memory_db();
        let data = sample_word();
        upsert_word(&conn, &data, "pt-BR").unwrap();
        let found = get_word(&conn, "CHURN", "pt-BR").unwrap();
        assert!(found.is_some());
    }

    #[test]
    fn test_get_word_missing_locale_returns_none() {
        let conn = in_memory_db();
        let data = sample_word();
        upsert_word(&conn, &data, "pt-BR").unwrap();
        // Locale "es" não existe para essa palavra
        let found = get_word(&conn, "churn", "es").unwrap();
        assert!(found.is_none());
    }

    #[test]
    fn test_toggle_saved() {
        let conn = in_memory_db();
        upsert_word(&conn, &sample_word(), "pt-BR").unwrap();
        let w = toggle_saved(&conn, "churn").unwrap();
        assert_eq!(w.is_saved, Some(1));
        let w2 = toggle_saved(&conn, "churn").unwrap();
        assert_eq!(w2.is_saved, Some(0));
    }

    #[test]
    fn test_json_serialization_roundtrip() {
        let conn = in_memory_db();
        let mut data = sample_word();
        data.synonyms = vec!["one".to_string(), "two".to_string()];
        data.antonyms = vec!["three".to_string()];
        upsert_word(&conn, &data, "pt-BR").unwrap();
        let found = get_word(&conn, "churn", "pt-BR").unwrap().unwrap();
        assert_eq!(found.synonyms, vec!["one", "two"]);
        assert_eq!(found.antonyms, vec!["three"]);
    }

    #[test]
    fn test_get_history_respects_in_history() {
        let conn = in_memory_db();
        upsert_word(&conn, &sample_word(), "pt-BR").unwrap();
        let history = get_history(&conn, "pt-BR", 30).unwrap();
        assert_eq!(history.len(), 1);
        remove_from_history(&conn, "churn").unwrap();
        let history2 = get_history(&conn, "pt-BR", 30).unwrap();
        assert_eq!(history2.len(), 0);
    }

    #[test]
    fn test_api_key_roundtrip() {
        let conn = in_memory_db();
        let key = get_api_key(&conn).unwrap();
        assert!(key.is_none());
        set_api_key(&conn, "gsk_test_key_123").unwrap();
        let key2 = get_api_key(&conn).unwrap();
        assert_eq!(key2, Some("gsk_test_key_123".to_string()));
    }
}
```

Executar com:
```bash
cd src/tauri && cargo test
```

---

## Adaptação dos Hooks (Frontend)

Nesta fase, adaptar os hooks para usar `invoke` no lugar de `window.lexio.*`, mas apenas para os commands já implementados:

### `src/renderer/hooks/useWords.ts` — exemplo de migração

```ts
import { invoke } from '../lib/tauri-bridge'
import type { Word, Locale } from '../../types'

export function useWords(locale: Locale) {
  const getHistory = (limit = 30) =>
    invoke<Word[]>('get_history', { locale, limit })

  const getSaved = () =>
    invoke<Word[]>('get_saved', { locale })

  // ... resto igual
  return { getHistory, getSaved }
}
```

**Convenção de nomes:** `camelCase` no frontend → `snake_case` nos command names Rust.
| Hook call | Command name |
|---|---|
| `getHistory` | `get_history` |
| `getSaved` | `get_saved` |
| `saveWord` | `save_word` |
| `toggleSaved` | `toggle_saved` |
| `deleteWord` | `delete_word` |
| `removeFromHistory` | `remove_from_history` |
| `unsaveWord` | `unsave_word` |
| `getApiKey` | `get_api_key` |
| `setApiKey` | `set_api_key` |
| `getAppVersion` | `get_app_version` |

---

## Critério de Saída da Fase 2

- [ ] `cargo test` passa com 0 falhas
- [ ] `invoke('get_history', ...)` retorna dados reais do SQLite no app rodando
- [ ] `invoke('set_api_key', ...)` persiste e é lido corretamente
- [ ] `invoke('toggle_saved', ...)` alterna o estado corretamente
- [ ] Histórico e salvos aparecem na UI com dados reais
- [ ] Nenhum `any` no TypeScript dos hooks atualizados
- [ ] `npm run build:renderer` passa sem erros
