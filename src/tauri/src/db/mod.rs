pub mod settings;
pub mod words;

use rusqlite::{Connection, Result};

pub fn init(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    conn.execute_batch(
        "
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
    ",
    )?;

    run_migrations(conn)?;

    Ok(())
}

fn run_migrations(conn: &Connection) -> Result<()> {
    let word_cols = get_columns(conn, "words")?;

    if !word_cols.contains(&"in_history".to_string()) {
        conn.execute_batch("ALTER TABLE words ADD COLUMN in_history INTEGER DEFAULT 1")?;
    }
    if !word_cols.contains(&"verb_forms".to_string()) {
        conn.execute_batch("ALTER TABLE words ADD COLUMN verb_forms TEXT")?;
    }
    if !word_cols.contains(&"meaning_en".to_string()) {
        conn.execute_batch("ALTER TABLE words ADD COLUMN meaning_en TEXT")?;
    }
    if !word_cols.contains(&"antonyms".to_string()) {
        conn.execute_batch("ALTER TABLE words ADD COLUMN antonyms TEXT DEFAULT '[]'")?;
    }

    let trans_cols = get_columns(conn, "word_translations")?;

    if !trans_cols.contains(&"meaning_short".to_string()) {
        conn.execute_batch("ALTER TABLE word_translations ADD COLUMN meaning_short TEXT")?;
    }
    if !trans_cols.contains(&"meanings".to_string()) {
        conn.execute_batch("ALTER TABLE word_translations ADD COLUMN meanings TEXT")?;
        migrate_old_meanings(conn)?;
    }

    Ok(())
}

fn get_columns(conn: &Connection, table: &str) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
    let cols = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>>>()?;
    Ok(cols)
}

fn migrate_old_meanings(conn: &Connection) -> Result<()> {
    let rows: Vec<(String, String, String)> = {
        let mut stmt = conn.prepare(
            "SELECT word, locale, meaning FROM word_translations WHERE meanings IS NULL AND meaning IS NOT NULL",
        )?;
        let mapped = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?
        .collect::<Result<Vec<_>>>()?;
        mapped
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
            rusqlite::params![entry.to_string(), &word, &locale],
        )?;
    }

    Ok(())
}

pub fn get_db_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    use tauri::Manager;
    app.path()
        .app_data_dir()
        .expect("failed to get app data dir")
        .join("lexio.db")
}
