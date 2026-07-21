// src/tauri/src/commands/assistant.rs
//
// Lexio Assistant: translate selected text into a dedicated window.
// Actions: translate / copy / close — no inject into the source app.

use arboard::Clipboard;
use tauri::{AppHandle, Manager, State};

use crate::ai_client;
use crate::ai_client::config::{OLLAMA_BASE_URL_DEFAULT, OLLAMA_MODEL_DEFAULT};
use crate::db::settings as db_settings;
use crate::state::AppState;
use crate::types::TranslationResponse;

pub const AI_TIMEOUT_SECS: u64 = 8;
pub const MIN_TEXT_LEN: usize = 2;
pub const MAX_TEXT_LEN: usize = 500;

/// Classification of captured selection before translating.
#[derive(Debug, PartialEq, Eq)]
pub enum SelectionKind {
    Ready(String),
    Empty,
    TooShort,
    TooLong,
    English,
}

/// Pure gate used by the hotkey handler (and unit tests).
pub fn classify_selection(text: Option<String>, is_english: impl Fn(&str) -> bool) -> SelectionKind {
    let Some(raw) = text else {
        return SelectionKind::Empty;
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return SelectionKind::Empty;
    }
    if trimmed.len() < MIN_TEXT_LEN {
        return SelectionKind::TooShort;
    }
    if trimmed.len() > MAX_TEXT_LEN {
        return SelectionKind::TooLong;
    }
    if is_english(trimmed) {
        return SelectionKind::English;
    }
    SelectionKind::Ready(trimmed.to_string())
}

#[tauri::command]
pub async fn assistant_translate(
    text: String,
    state: State<'_, AppState>,
) -> Result<TranslationResponse, String> {
    let original_text = text.trim().to_string();
    if original_text.len() < MIN_TEXT_LEN {
        return Err("Texto muito curto para traduzir.".to_string());
    }
    if original_text.len() > MAX_TEXT_LEN {
        return Err("Texto demasiado longo para traduzir.".to_string());
    }

    let provider = {
        let conn = state
            .db
            .lock()
            .map_err(|e| format!("Failed to lock db: {}", e))?;

        db_settings::get_selected_provider(&conn)
            .map_err(|e| format!("DB error: {}", e))?
            .unwrap_or_else(|| "gemini".to_string())
    };

    let (api_key, ollama_base_url, ollama_model) = {
        let conn = state
            .db
            .lock()
            .map_err(|e| format!("Failed to lock db: {}", e))?;

        let key = match provider.as_str() {
            "groq" => db_settings::get_groq_api_key(&conn),
            "ollama" => Ok(Some(String::new())),
            _ => db_settings::get_api_key(&conn),
        };
        let key = key
            .map_err(|e| format!("DB error: {}", e))?
            .unwrap_or_default();

        let ollama_url = db_settings::get_ollama_base_url(&conn)
            .map_err(|e| format!("DB error: {}", e))?
            .unwrap_or_else(|| OLLAMA_BASE_URL_DEFAULT.to_string());

        let ollama_mdl = db_settings::get_ollama_model(&conn)
            .map_err(|e| format!("DB error: {}", e))?
            .unwrap_or_else(|| OLLAMA_MODEL_DEFAULT.to_string());

        (key, ollama_url, ollama_mdl)
    };

    if provider != "ollama" && api_key.is_empty() {
        return Err(format!(
            "Chave {} não configurada. Acesse Configurações.",
            provider
        ));
    }

    let timeout_secs = if provider == "ollama" { 120u64 } else { AI_TIMEOUT_SECS };
    let http = if provider == "ollama" {
        &state.http_local
    } else {
        &state.http
    };

    let translation = match tokio::time::timeout(
        std::time::Duration::from_secs(timeout_secs),
        ai_client::fetch_translation(
            http,
            &provider,
            &api_key,
            &original_text,
            &ollama_base_url,
            &ollama_model,
        ),
    )
    .await
    {
        Ok(Ok(t)) => t,
        Ok(Err(e)) => return Err(e),
        Err(_) => {
            return Err("Tempo limite excedido. Verifique sua conexão.".to_string());
        }
    };

    Ok(TranslationResponse {
        original: original_text,
        translation,
    })
}

#[tauri::command]
pub fn assistant_close(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("assistant") {
        win.hide().map_err(|e| format!("Failed to hide assistant: {}", e))?;
    }
    Ok(())
}

/// Hides the assistant and opens the main Lexio dictionary window.
#[tauri::command]
pub fn assistant_open_main(app: AppHandle) -> Result<(), String> {
    if let Some(assistant) = app.get_webview_window("assistant") {
        assistant.hide().ok();
    }

    let Some(main) = app.get_webview_window("main") else {
        return Err("Main window not found".to_string());
    };

    if main.is_minimized().unwrap_or(false) {
        main.unminimize().ok();
    }
    crate::shortcuts::reposition_to_cursor_screen(&app, &main);
    main.set_skip_taskbar(false).ok();
    main.show()
        .map_err(|e| format!("Failed to show main: {}", e))?;
    main.set_focus()
        .map_err(|e| format!("Failed to focus main: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn assistant_copy_to_clipboard(text: String) -> Result<(), String> {
    let mut clipboard =
        Clipboard::new().map_err(|e| format!("Failed to open clipboard: {}", e))?;
    clipboard
        .set_text(text)
        .map_err(|e| format!("Failed to set clipboard: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_empty_when_none() {
        assert_eq!(
            classify_selection(None, |_| false),
            SelectionKind::Empty
        );
    }

    #[test]
    fn classify_empty_when_whitespace() {
        assert_eq!(
            classify_selection(Some("  \n".into()), |_| false),
            SelectionKind::Empty
        );
    }

    #[test]
    fn classify_too_short() {
        assert_eq!(
            classify_selection(Some("a".into()), |_| false),
            SelectionKind::TooShort
        );
    }

    #[test]
    fn classify_too_long() {
        let long = "x".repeat(MAX_TEXT_LEN + 1);
        assert_eq!(
            classify_selection(Some(long), |_| false),
            SelectionKind::TooLong
        );
    }

    #[test]
    fn classify_english() {
        assert_eq!(
            classify_selection(Some("hello there friend".into()), |_| true),
            SelectionKind::English
        );
    }

    #[test]
    fn classify_ready_trims() {
        assert_eq!(
            classify_selection(Some("  olá mundo  ".into()), |_| false),
            SelectionKind::Ready("olá mundo".into())
        );
    }

    #[test]
    fn missing_api_key_message_includes_provider() {
        let provider = "gemini";
        let msg = format!(
            "Chave {} não configurada. Acesse Configurações.",
            provider
        );
        assert!(msg.contains("gemini"));
    }

    #[test]
    fn timeout_message_is_user_friendly() {
        let msg = "Tempo limite excedido. Verifique sua conexão.".to_string();
        assert!(msg.contains("Tempo limite"));
    }
}
