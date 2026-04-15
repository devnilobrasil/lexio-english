use crate::ai_client;
use crate::ai_client::config::{OLLAMA_BASE_URL_DEFAULT, OLLAMA_MODEL_DEFAULT};
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

    // 2. Cache miss — read selected provider and its API key
    let provider = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db_settings::get_selected_provider(&conn)
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| "gemini".to_string())
    };

    let (api_key, ollama_base_url, ollama_model) = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let key = match provider.as_str() {
            "groq" => db_settings::get_groq_api_key(&conn),
            "ollama" => Ok(Some(String::new())), // ollama doesn't need a key
            _ => db_settings::get_api_key(&conn),
        };
        let key = key.map_err(|e| e.to_string())?.unwrap_or_default();

        let ollama_url = db_settings::get_ollama_base_url(&conn)
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| OLLAMA_BASE_URL_DEFAULT.to_string());

        let ollama_mdl = db_settings::get_ollama_model(&conn)
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| OLLAMA_MODEL_DEFAULT.to_string());

        (key, ollama_url, ollama_mdl)
    };

    // 3. Call AI — use high-timeout client for local Ollama inference
    let http = if provider == "ollama" { &state.http_local } else { &state.http };
    let ai_response = ai_client::fetch_word(
        http,
        &provider,
        &api_key,
        &word,
        &locale,
        &ollama_base_url,
        &ollama_model,
    )
    .await?;

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

#[tauri::command]
pub fn get_groq_api_key(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_settings::get_groq_api_key(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_groq_api_key(key: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_settings::set_groq_api_key(&conn, &key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_selected_provider(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_settings::get_selected_provider(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_selected_provider(provider: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_settings::set_selected_provider(&conn, &provider).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_ollama_base_url(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_settings::get_ollama_base_url(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_ollama_base_url(url: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_settings::set_ollama_base_url(&conn, &url).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_ollama_model(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_settings::get_ollama_model(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_ollama_model(model: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db_settings::set_ollama_model(&conn, &model).map_err(|e| e.to_string())
}

/// Diagnostic command — tests POST to Ollama chat completions endpoint.
#[tauri::command]
pub async fn diagnose_ollama(state: State<'_, AppState>) -> Result<String, String> {
    let url = "http://127.0.0.1:11434/v1/chat/completions";
    let body = serde_json::json!({
        "model": "gemma4:26b",
        "messages": [{"role": "user", "content": "say hi"}],
        "think": false
    });

    match state.http_local.post(url).json(&body).send().await {
        Ok(resp) => {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            Ok(format!("status={}\nbody={}", status, &text[..text.len().min(300)]))
        }
        Err(e) => Err(format!(
            "FAIL: {}\n  is_connect={}\n  is_timeout={}\n  is_request={}",
            e, e.is_connect(), e.is_timeout(), e.is_request()
        )),
    }
}
