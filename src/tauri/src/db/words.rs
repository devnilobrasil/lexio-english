use crate::types::{AIWordResponse, Word};
use rusqlite::{params, Connection};

pub fn get_word(conn: &Connection, word: &str, locale: &str) -> rusqlite::Result<Option<Word>> {
    let mut stmt = conn.prepare(
        "
        SELECT w.id, w.word, w.phonetic, w.pos, w.level, w.verb_forms,
               w.synonyms, w.antonyms, w.contexts,
               w.created_at, w.last_viewed, w.view_count, w.is_saved,
               wt.meanings
        FROM words w
        LEFT JOIN word_translations wt ON wt.word = w.word AND wt.locale = ?1
        WHERE w.word = ?2 COLLATE NOCASE
    ",
    )?;

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

pub fn upsert_word(
    conn: &Connection,
    data: &AIWordResponse,
    locale: &str,
) -> rusqlite::Result<Word> {
    conn.execute(
        "
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
    ",
        params![
            data.word,
            data.phonetic,
            data.pos,
            data.level,
            data.verb_forms
                .as_ref()
                .map(|v| serde_json::to_string(v).unwrap()),
            serde_json::to_string(&data.synonyms).unwrap(),
            serde_json::to_string(&data.antonyms).unwrap(),
            serde_json::to_string(&data.contexts).unwrap(),
        ],
    )?;

    let first_meaning = data
        .meanings
        .first()
        .map(|m| m.meaning.clone())
        .unwrap_or_default();
    conn.execute(
        "
        INSERT INTO word_translations (word, locale, meaning, meanings)
        VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(word, locale) DO UPDATE SET
            meaning  = excluded.meaning,
            meanings = excluded.meanings
    ",
        params![
            data.word,
            locale,
            first_meaning,
            serde_json::to_string(&data.meanings).unwrap(),
        ],
    )?;

    get_word(conn, &data.word, locale).map(|w| w.expect("word must exist after upsert"))
}

pub fn toggle_saved(conn: &Connection, word: &str) -> rusqlite::Result<Word> {
    conn.execute(
        "UPDATE words SET is_saved = CASE WHEN is_saved = 1 THEN 0 ELSE 1 END WHERE word = ?1",
        params![word],
    )?;

    let mut stmt = conn.prepare(
        "
        SELECT w.id, w.word, w.phonetic, w.pos, w.level, w.verb_forms,
               w.synonyms, w.antonyms, w.contexts,
               w.created_at, w.last_viewed, w.view_count, w.is_saved,
               wt.meanings
        FROM words w
        LEFT JOIN word_translations wt ON wt.word = w.word
        WHERE w.word = ?1
        ORDER BY wt.locale ASC
        LIMIT 1
    ",
    )?;
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
    conn.execute(
        "UPDATE words SET in_history = 0 WHERE word = ?1",
        params![word],
    )?;
    Ok(())
}

pub fn unsave_word(conn: &Connection, word: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE words SET is_saved = 0 WHERE word = ?1",
        params![word],
    )?;
    Ok(())
}

pub fn get_history(
    conn: &Connection,
    locale: &str,
    limit: u32,
) -> rusqlite::Result<Vec<Word>> {
    let safe_limit = limit.max(1).min(200);
    let mut stmt = conn.prepare(&format!(
        "
        SELECT w.id, w.word, w.phonetic, w.pos, w.level, w.verb_forms,
               w.synonyms, w.antonyms, w.contexts,
               w.created_at, w.last_viewed, w.view_count, w.is_saved,
               wt.meanings
        FROM words w
        LEFT JOIN word_translations wt ON wt.word = w.word AND wt.locale = ?1
        WHERE w.in_history = 1
        ORDER BY w.last_viewed DESC LIMIT {}
    ",
        safe_limit
    ))?;

    let rows = stmt
        .query_map(params![locale], |row| {
            let meanings_json: Option<String> = row.get(13)?;
            row_to_word(row, meanings_json)
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(rows)
}

pub fn get_saved(conn: &Connection, locale: &str) -> rusqlite::Result<Vec<Word>> {
    let mut stmt = conn.prepare(
        "
        SELECT w.id, w.word, w.phonetic, w.pos, w.level, w.verb_forms,
               w.synonyms, w.antonyms, w.contexts,
               w.created_at, w.last_viewed, w.view_count, w.is_saved,
               wt.meanings
        FROM words w
        LEFT JOIN word_translations wt ON wt.word = w.word AND wt.locale = ?1
        WHERE w.is_saved = 1
        ORDER BY w.word ASC
    ",
    )?;

    let rows = stmt
        .query_map(params![locale], |row| {
            let meanings_json: Option<String> = row.get(13)?;
            row_to_word(row, meanings_json)
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(rows)
}

fn row_to_word(row: &rusqlite::Row, meanings_json: Option<String>) -> rusqlite::Result<Word> {
    let verb_forms_json: Option<String> = row.get(5)?;
    let synonyms_json: String = row
        .get::<_, Option<String>>(6)?
        .unwrap_or_else(|| "[]".to_string());
    let antonyms_json: String = row
        .get::<_, Option<String>>(7)?
        .unwrap_or_else(|| "[]".to_string());
    let contexts_json: String = row
        .get::<_, Option<String>>(8)?
        .unwrap_or_else(|| "[]".to_string());

    Ok(Word {
        id: row.get(0)?,
        word: row.get(1)?,
        phonetic: row.get(2)?,
        pos: row.get(3)?,
        level: row.get(4)?,
        verb_forms: verb_forms_json.and_then(|j| serde_json::from_str(&j).ok()),
        meanings: meanings_json
            .and_then(|j| serde_json::from_str(&j).ok())
            .unwrap_or_default(),
        synonyms: serde_json::from_str(&synonyms_json).unwrap_or_default(),
        antonyms: serde_json::from_str(&antonyms_json).unwrap_or_default(),
        contexts: serde_json::from_str(&contexts_json).unwrap_or_default(),
        created_at: row.get(9)?,
        last_viewed: row.get(10)?,
        view_count: row.get(11)?,
        is_saved: row.get(12)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::types::{AIWordResponse, MeaningEntry, WordExample};

    fn in_memory_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        db::init(&conn).unwrap();
        conn
    }

    fn sample_word() -> AIWordResponse {
        AIWordResponse {
            word: "churn".to_string(),
            phonetic: Some("/tʃɜːrn/".to_string()),
            pos: Some("verb".to_string()),
            level: Some("Advanced".to_string()),
            verb_forms: None,
            meanings: vec![MeaningEntry {
                context: "Business".to_string(),
                meaning_en: "to cancel a subscription".to_string(),
                meaning_short: "cancelar".to_string(),
                meaning: "Cancelar uma assinatura ou serviço".to_string(),
                examples: vec![WordExample {
                    en: "Many users churn after the free trial.".to_string(),
                    translation: "Muitos usuários cancelam após o período gratuito."
                        .to_string(),
                }],
            }],
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
    fn test_delete_word() {
        let conn = in_memory_db();
        upsert_word(&conn, &sample_word(), "pt-BR").unwrap();
        delete_word(&conn, "churn").unwrap();
        let found = get_word(&conn, "churn", "pt-BR").unwrap();
        assert!(found.is_none());
    }

    #[test]
    fn test_unsave_word() {
        let conn = in_memory_db();
        upsert_word(&conn, &sample_word(), "pt-BR").unwrap();
        toggle_saved(&conn, "churn").unwrap(); // saved = 1
        unsave_word(&conn, "churn").unwrap();
        let found = get_word(&conn, "churn", "pt-BR").unwrap().unwrap();
        assert_eq!(found.is_saved, Some(0));
    }

    #[test]
    fn test_get_saved() {
        let conn = in_memory_db();
        upsert_word(&conn, &sample_word(), "pt-BR").unwrap();
        let saved = get_saved(&conn, "pt-BR").unwrap();
        assert_eq!(saved.len(), 0);
        toggle_saved(&conn, "churn").unwrap();
        let saved2 = get_saved(&conn, "pt-BR").unwrap();
        assert_eq!(saved2.len(), 1);
        assert_eq!(saved2[0].word, "churn");
    }

    #[test]
    fn test_meanings_roundtrip() {
        let conn = in_memory_db();
        let data = sample_word();
        upsert_word(&conn, &data, "pt-BR").unwrap();
        let found = get_word(&conn, "churn", "pt-BR").unwrap().unwrap();
        assert_eq!(found.meanings.len(), 1);
        assert_eq!(found.meanings[0].context, "Business");
        assert_eq!(found.meanings[0].examples.len(), 1);
    }

    #[test]
    fn test_upsert_updates_existing_word() {
        let conn = in_memory_db();
        let data = sample_word();
        upsert_word(&conn, &data, "pt-BR").unwrap();

        let mut updated = sample_word();
        updated.level = Some("Basic".to_string());
        updated.synonyms = vec!["stir".to_string()];
        upsert_word(&conn, &updated, "pt-BR").unwrap();

        let found = get_word(&conn, "churn", "pt-BR").unwrap().unwrap();
        assert_eq!(found.level, Some("Basic".to_string()));
        assert_eq!(found.synonyms, vec!["stir"]);
    }
}
