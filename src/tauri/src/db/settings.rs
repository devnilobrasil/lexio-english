use rusqlite::{params, Connection};

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

pub fn get_groq_api_key(conn: &Connection) -> rusqlite::Result<Option<String>> {
    get_setting(conn, "groq_api_key")
}

pub fn set_groq_api_key(conn: &Connection, key: &str) -> rusqlite::Result<()> {
    set_setting(conn, "groq_api_key", key)
}

pub fn get_selected_provider(conn: &Connection) -> rusqlite::Result<Option<String>> {
    get_setting(conn, "selected_provider")
}

pub fn set_selected_provider(conn: &Connection, provider: &str) -> rusqlite::Result<()> {
    set_setting(conn, "selected_provider", provider)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use rusqlite::Connection;

    fn in_memory_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        db::init(&conn).unwrap();
        conn
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

    #[test]
    fn test_setting_upsert() {
        let conn = in_memory_db();
        set_setting(&conn, "theme", "dark").unwrap();
        assert_eq!(get_setting(&conn, "theme").unwrap(), Some("dark".to_string()));
        set_setting(&conn, "theme", "light").unwrap();
        assert_eq!(get_setting(&conn, "theme").unwrap(), Some("light".to_string()));
    }

    #[test]
    fn test_get_missing_setting() {
        let conn = in_memory_db();
        assert_eq!(get_setting(&conn, "nonexistent").unwrap(), None);
    }

    #[test]
    fn get_groq_api_key_returns_none_when_unset() {
        let conn = in_memory_db();
        assert_eq!(get_groq_api_key(&conn).unwrap(), None);
    }

    #[test]
    fn set_and_get_groq_api_key_roundtrip() {
        let conn = in_memory_db();
        set_groq_api_key(&conn, "gsk_groq_test_key").unwrap();
        assert_eq!(
            get_groq_api_key(&conn).unwrap(),
            Some("gsk_groq_test_key".to_string())
        );
    }

    #[test]
    fn groq_and_gemini_keys_are_independent() {
        let conn = in_memory_db();
        set_api_key(&conn, "gemini_key").unwrap();
        set_groq_api_key(&conn, "groq_key").unwrap();
        assert_eq!(get_api_key(&conn).unwrap(), Some("gemini_key".to_string()));
        assert_eq!(get_groq_api_key(&conn).unwrap(), Some("groq_key".to_string()));
    }

    #[test]
    fn get_selected_provider_returns_none_when_unset() {
        let conn = in_memory_db();
        assert_eq!(get_selected_provider(&conn).unwrap(), None);
    }

    #[test]
    fn set_and_get_selected_provider_roundtrip() {
        let conn = in_memory_db();
        set_selected_provider(&conn, "groq").unwrap();
        assert_eq!(
            get_selected_provider(&conn).unwrap(),
            Some("groq".to_string())
        );
    }

    #[test]
    fn selected_provider_can_be_updated() {
        let conn = in_memory_db();
        set_selected_provider(&conn, "gemini").unwrap();
        set_selected_provider(&conn, "groq").unwrap();
        assert_eq!(
            get_selected_provider(&conn).unwrap(),
            Some("groq".to_string())
        );
    }
}
