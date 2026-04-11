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
}
