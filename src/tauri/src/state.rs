use reqwest::Client;
use rusqlite::Connection;
use std::sync::Mutex;

use crate::types::PendingSuggestion;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub http: Client,
    pub http_local: Client, // higher timeout for local Ollama inference
    pub pending_suggestion: Mutex<Option<PendingSuggestion>>,
}

impl AppState {
    pub fn new(conn: Connection) -> Self {
        AppState {
            db: Mutex::new(conn),
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("failed to build HTTP client"),
            http_local: Client::builder()
                .timeout(std::time::Duration::from_secs(180))
                .no_proxy()
                .build()
                .expect("failed to build local HTTP client"),
            pending_suggestion: Mutex::new(None),
        }
    }
}
