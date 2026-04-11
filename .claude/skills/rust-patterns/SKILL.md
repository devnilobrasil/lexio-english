---
name: rust-patterns
description: Use when writing Rust code for the Lexio Tauri backend. Covers AppState with Mutex, Result error handling for commands, serde for IPC types, module organization, and async patterns specific to this project.
---

# Rust Patterns for Lexio Tauri Backend

## Overview

Lexio's Rust backend follows a small set of recurring patterns: shared state via `Mutex`, `Result<T, String>` as the command error contract, `serde` for all IPC types, and a consistent module layout. This skill documents these patterns so they're applied consistently across all phases.

---

## AppState Pattern

All shared resources live in a single `AppState` registered with `.manage()`:

```rust
// src/tauri/src/state.rs
use rusqlite::Connection;
use reqwest::Client;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub http: Client,          // Client is already Arc-based; no Mutex needed
}

impl AppState {
    pub fn new(conn: Connection) -> Self {
        AppState {
            db: Mutex::new(conn),
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("failed to build HTTP client"),
        }
    }
}
```

**Why `Mutex<Connection>` not `Arc<Mutex<Connection>>`:** `tauri::State<'_, AppState>` already wraps in `Arc` internally.

**Why `Client` without `Mutex`:** `reqwest::Client` is `Send + Sync` and clone-cheap by design. One instance, shared freely.

---

## Error Handling Contract

All Tauri commands return `Result<T, String>`. The `String` is sent to the renderer as-is.

```rust
// ✅ Standard pattern
pub fn get_history(locale: String, state: State<'_, AppState>) -> Result<Vec<Word>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_words::get_history(&conn, &locale, 30).map_err(|e| e.to_string())
}

// Pattern for propagating multiple error types
fn helper() -> Result<String, String> {
    let value = some_call().map_err(|e| format!("context: {}", e))?;
    Ok(value)
}
```

**Never use `unwrap()` in command code.** Use `?` with `.map_err(|e| e.to_string())`.

---

## Serde for IPC Types

Every type that crosses the IPC boundary (sent to or received from renderer) must derive `Serialize` and `Deserialize`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Word {
    pub id: Option<i64>,
    pub word: String,
    pub phonetic: Option<String>,
    pub meanings: Vec<MeaningEntry>,
    pub synonyms: Vec<String>,
    // ...
}
```

**JSON fields stored in SQLite (arrays, nested objects) require manual round-trip:**

```rust
// Serializing to store in SQLite
let synonyms_json = serde_json::to_string(&data.synonyms).unwrap_or("[]".to_string());

// Deserializing when reading from SQLite
let synonyms: Vec<String> = serde_json::from_str(&row_synonyms).unwrap_or_default();
```

This is the Rust equivalent of `JSON.stringify` / `JSON.parse` in `db.ts`.

---

## Module Organization

```
src/tauri/src/
├── main.rs           ← app setup, plugin registration, invoke_handler
├── state.rs          ← AppState struct only
├── types.rs          ← all shared types (Word, AIWordResponse, etc.)
├── db/
│   ├── mod.rs        ← init(), migrations, get_db_path()
│   ├── words.rs      ← get_word, upsert_word, toggle_saved, etc.
│   └── settings.rs   ← get_api_key, set_api_key
├── ai_client/
│   ├── mod.rs        ← HTTP client functions (fetch_word, fetch_translation)
│   ├── word_prompt.rs    ← SYSTEM_PROMPT, build_user_prompt()
│   └── translate_prompt.rs
├── commands/
│   ├── mod.rs        ← pub use re-exports
│   ├── words.rs      ← Tauri commands delegating to db/
│   ├── window.rs     ← close_window, resize_window, etc.
│   └── overlay.rs    ← trigger_translate
├── shortcuts.rs      ← global shortcut registration
├── tray.rs           ← system tray setup
├── text_bridge.rs    ← clipboard capture + keyboard injection
└── updater.rs        ← auto-updater logic
```

**Rule:** Commands in `commands/` only delegate — no business logic. Logic lives in `db/` or `ai_client/`.

---

## Async Patterns

### Mutex lock must be released before `.await`

```rust
// ✅ Release lock before awaiting
pub async fn get_word(word: String, state: State<'_, AppState>) -> Result<Option<Word>, String> {
    // Block scope drops the MutexGuard before the await
    let cached = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db_words::get_word(&conn, &word, "pt-BR").map_err(|e| e.to_string())?
    }; // <-- guard dropped here

    if cached.is_some() { return Ok(cached); }

    let result = http_client.get("...").send().await?; // safe: no lock held
    Ok(Some(result))
}
```

### Spawning async work from sync context (e.g., shortcuts)

```rust
tauri::async_runtime::spawn(async move {
    do_async_work().await;
});
```

### Sleep in async context — use tokio, not thread::sleep

```rust
// ✅ async context
tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;

// ✅ sync context (text_bridge.rs, clipboard operations)
std::thread::sleep(std::time::Duration::from_millis(80));
```

---

## Rusqlite Patterns

```rust
// Query returning optional single row
pub fn get_word(conn: &Connection, word: &str) -> rusqlite::Result<Option<Word>> {
    let result = conn.query_row("SELECT ... WHERE word = ?1", params![word], |row| {
        Ok(map_row(row))
    });
    match result {
        Ok(w) => Ok(Some(w)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

// Query returning multiple rows
pub fn get_history(conn: &Connection, locale: &str) -> rusqlite::Result<Vec<Word>> {
    let mut stmt = conn.prepare("SELECT ... WHERE locale = ?1")?;
    let rows = stmt.query_map(params![locale], |row| Ok(map_row(row)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

// Upsert
conn.execute("INSERT INTO words (...) VALUES (?) ON CONFLICT(...) DO UPDATE SET ...", params![...])?;
```

---

## Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn in_memory_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::init(&conn).unwrap();
        conn
    }

    #[test]
    fn test_upsert_and_retrieve() {
        let conn = in_memory_db();
        // ... test logic
    }
}
```

Run with: `cd src/tauri && cargo test`

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| `unwrap()` in command code | Use `?` + `.map_err(|e| e.to_string())` |
| `thread::sleep` in async fn | Use `tokio::time::sleep(...).await` |
| Holding `MutexGuard` across `.await` | Wrap the lock in an inner `{ }` block |
| Missing `Serialize` on a type returned by command | Add `#[derive(Serialize, Deserialize)]` |
| SQL in commands/ | SQL belongs in `db/` only |
| Business logic in commands/ | Commands delegate; logic in `db/` or `ai_client/` |
