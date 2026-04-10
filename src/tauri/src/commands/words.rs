use crate::ai_client;
use crate::db::{settings as db_settings, words as db_words};
use crate::state::AppState;
use crate::types::{AIWordResponse, Word};
use tauri::State;

#[tauri::command]
pub async fn get_word(
    word: String,
    locale: String,
    state: State<'_, AppState>,
) -> Result<Option<Word>, String> {
    // 1. Try SQLite cache
    let cached = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db_words::get_word(&conn, &word, &locale).map_err(|e| e.to_string())?
    };

    if cached.is_some() {
        return Ok(cached);
    }

    // 2. Cache miss — get API key
    let api_key = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db_settings::get_api_key(&conn).map_err(|e| e.to_string())?
    };
    let api_key = api_key.ok_or("API key not configured. Please set it in Settings.")?;

    // 3. Call Gemini
    let ai_response = ai_client::fetch_word(&state.http, &api_key, &word, &locale).await?;

    // 4. Auto-save to SQLite
    let saved = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db_words::upsert_word(&conn, &ai_response, &locale).map_err(|e| e.to_string())?
    };

    Ok(Some(saved))
}

#[tauri::command]
pub fn get_history(
    locale: String,
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<Word>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_words::get_history(&conn, &locale, limit.unwrap_or(30)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_saved(locale: String, state: State<'_, AppState>) -> Result<Vec<Word>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_words::get_saved(&conn, &locale).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_word(
    data: AIWordResponse,
    locale: String,
    state: State<'_, AppState>,
) -> Result<Word, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_words::upsert_word(&conn, &data, &locale).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_saved(word: String, state: State<'_, AppState>) -> Result<Word, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_words::toggle_saved(&conn, &word).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_word(word: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_words::delete_word(&conn, &word).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_from_history(word: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_words::remove_from_history(&conn, &word).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn unsave_word(word: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_words::unsave_word(&conn, &word).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_api_key(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_settings::get_api_key(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_api_key(key: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_settings::set_api_key(&conn, &key).map_err(|e| e.to_string())
}
