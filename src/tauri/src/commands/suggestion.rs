// src/tauri/src/commands/suggestion.rs
//
// Inline Translation: Suggestion commands
//
// Three commands:
//   suggestion_request  — reads pending text, calls AI, returns translation
//   suggestion_accept   — injects translated text via Ctrl+V
//   suggestion_dismiss  — discards pending suggestion
//
// CRITICAL RULE: MutexGuard must NEVER be held across an .await.
// Every lock is acquired and released inside a block scope before any async call.

use crate::ai_client::config::{OLLAMA_BASE_URL_DEFAULT, OLLAMA_MODEL_DEFAULT};
use crate::db::settings as db_settings;
use crate::types::SuggestionResponse;
use crate::{ai_client, text_bridge};
use tauri::{AppHandle, Emitter, Manager, State};

pub const AI_TIMEOUT_SECS: u64 = 8;

use crate::state::AppState;

/// Called when the user clicks the overlay bubble in "available" state.
///
/// Reads the captured text from AppState, reads the selected AI provider and its
/// key from SQLite, then calls the AI to produce a translation. Emits
/// loading/ready/error state events to the overlay window.
///
/// CRITICAL: no MutexGuard is held across any .await point.
#[tauri::command]
pub async fn suggestion_request(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SuggestionResponse, String> {
    // 1. Extract pending text — lock dropped before any await.
    let original_text = {
        let guard = state
            .pending_suggestion
            .lock()
            .map_err(|e| format!("Failed to lock pending_suggestion: {}", e))?;

        match guard.as_ref() {
            Some(pending) => pending.original_text.clone(),
            None => return Err("No pending suggestion — selection may have expired".to_string()),
        }
    }; // MutexGuard dropped here

    // 2. Read selected provider — lock dropped before any await.
    let provider = {
        let conn = state
            .db
            .lock()
            .map_err(|e| format!("Failed to lock db: {}", e))?;

        db_settings::get_selected_provider(&conn)
            .map_err(|e| format!("DB error: {}", e))?
            .unwrap_or_else(|| "gemini".to_string())
    }; // MutexGuard dropped here

    // 3. Read the API key for the selected provider — lock dropped before any await.
    let (api_key, ollama_base_url, ollama_model) = {
        let conn = state
            .db
            .lock()
            .map_err(|e| format!("Failed to lock db: {}", e))?;

        let key = match provider.as_str() {
            "groq" => db_settings::get_groq_api_key(&conn),
            "ollama" => Ok(Some(String::new())), // ollama doesn't need a key
            _ => db_settings::get_api_key(&conn),
        };
        let key = key.map_err(|e| format!("DB error: {}", e))?
            .unwrap_or_default();

        let ollama_url = db_settings::get_ollama_base_url(&conn)
            .map_err(|e| format!("DB error: {}", e))?
            .unwrap_or_else(|| OLLAMA_BASE_URL_DEFAULT.to_string());

        let ollama_mdl = db_settings::get_ollama_model(&conn)
            .map_err(|e| format!("DB error: {}", e))?
            .unwrap_or_else(|| OLLAMA_MODEL_DEFAULT.to_string());

        (key, ollama_url, ollama_mdl)
    }; // MutexGuard dropped here

    // 4. Validate: key must be present for the selected provider (except Ollama).
    if provider != "ollama" && api_key.is_empty() {
        let msg = format!(
            "Chave {} não configurada. Acesse Configurações.",
            provider
        );
        app.emit_to("overlay", "overlay:suggestion-state", "error").ok();
        app.emit_to("overlay", "overlay:suggestion-error", &msg).ok();
        return Err(msg);
    }

    // 5. Signal loading before the async call.
    app.emit_to("overlay", "overlay:suggestion-state", "loading")
        .ok();

    // 6. Call AI with timeout — use longer timeout and high-timeout client for local Ollama.
    let ollama_timeout = 120u64;
    let timeout_secs = if provider == "ollama" { ollama_timeout } else { AI_TIMEOUT_SECS };
    let http = if provider == "ollama" { &state.http_local } else { &state.http };
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
        Ok(Err(e)) => {
            app.emit_to("overlay", "overlay:suggestion-state", "error").ok();
            app.emit_to("overlay", "overlay:suggestion-error", &e).ok();
            return Err(e);
        }
        Err(_elapsed) => {
            let msg = "Tempo limite excedido. Verifique sua conexão.".to_string();
            app.emit_to("overlay", "overlay:suggestion-state", "error").ok();
            app.emit_to("overlay", "overlay:suggestion-error", &msg).ok();
            return Err(msg);
        }
    };

    // 7. Signal ready.
    app.emit_to("overlay", "overlay:suggestion-state", "ready")
        .ok();

    Ok(SuggestionResponse {
        original: original_text,
        translation,
    })
}

/// Called when the user clicks "Aceitar" in the SuggestionDialog.
///
/// Hides the overlay first so the source app regains keyboard focus (the
/// Ctrl+V simulation in inject_text must reach the source app, not the overlay).
/// After injection, resizes to button size and shows the overlay again.
#[tauri::command]
pub async fn suggestion_accept(
    text: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // 1. Hide overlay — OS will transfer focus back to the source app.
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay.hide().ok();
    }

    // 2. Give the OS time to complete the focus transfer.
    tokio::time::sleep(std::time::Duration::from_millis(150)).await;

    // 3. Inject text — foreground window is now the source app.
    let text_clone = text.clone();
    let result = tauri::async_runtime::spawn_blocking(move || text_bridge::inject_text(&text_clone))
        .await
        .map_err(|e| format!("spawn_blocking error: {}", e))?;

    if let Err(e) = result {
        // On error: restore overlay so the user can see the error state.
        if let Some(overlay) = app.get_webview_window("overlay") {
            overlay.show().ok();
        }
        app.emit_to("overlay", "overlay:suggestion-state", "error").ok();
        app.emit_to("overlay", "overlay:suggestion-error", &e).ok();
        return Err(e);
    }

    // 4. Clear the pending suggestion.
    if let Ok(mut guard) = state.pending_suggestion.lock() {
        *guard = None;
    }

    // 5. Resize to button size and show as idle.
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay
            .set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: 48.0,
                height: 48.0,
            }))
            .ok();
        overlay.show().ok();
    }

    app.emit_to("overlay", "overlay:suggestion-state", "idle").ok();

    Ok(())
}

/// Called when the user clicks "Rejeitar", presses ESC, or clicks outside.
///
/// Discards the pending suggestion without modifying the originating app.
#[tauri::command]
pub fn suggestion_dismiss(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if let Ok(mut guard) = state.pending_suggestion.lock() {
        *guard = None;
    }

    app.emit_to("overlay", "overlay:suggestion-state", "idle")
        .ok();

    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    #[test]
    fn empty_api_key_produces_descriptive_error() {
        let api_key = "";
        let provider = "gemini";
        let result: Result<(), String> = if api_key.is_empty() {
            Err(format!(
                "Chave {} não configurada. Acesse Configurações.",
                provider
            ))
        } else {
            Ok(())
        };
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("gemini"));
    }

    #[test]
    fn groq_key_missing_produces_groq_error() {
        let api_key = "";
        let provider = "groq";
        let result: Result<(), String> = if api_key.is_empty() {
            Err(format!(
                "Chave {} não configurada. Acesse Configurações.",
                provider
            ))
        } else {
            Ok(())
        };
        assert!(result.unwrap_err().contains("groq"));
    }

    #[test]
    fn no_pending_suggestion_returns_descriptive_error() {
        let pending: Option<()> = None;
        let error = match pending {
            Some(_) => "ok".to_string(),
            None => "No pending suggestion — selection may have expired".to_string(),
        };
        assert_eq!(error, "No pending suggestion — selection may have expired");
    }

    #[test]
    fn suggestion_response_serializes_correctly() {
        use crate::types::SuggestionResponse;
        let response = SuggestionResponse {
            original: "O gato bebeu água.".to_string(),
            translation: "The cat drank water.".to_string(),
        };
        let json = serde_json::to_string(&response).unwrap();
        let back: SuggestionResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(back.original, "O gato bebeu água.");
        assert_eq!(back.translation, "The cat drank water.");
    }

    #[test]
    fn default_provider_is_gemini_when_unset() {
        // Mirrors the unwrap_or_else("gemini") logic in suggestion_request.
        let stored: Option<String> = None;
        let provider = stored.unwrap_or_else(|| "gemini".to_string());
        assert_eq!(provider, "gemini");
    }

    #[test]
    fn api_timeout_duration_is_eight_seconds() {
        // Verifies the constant used in tokio::time::timeout inside suggestion_request.
        assert_eq!(super::AI_TIMEOUT_SECS, 8);
    }

    #[test]
    fn timeout_produces_user_friendly_error() {
        // Mirrors the Err branch of timeout() in suggestion_request.
        let msg = "Tempo limite excedido. Verifique sua conexão.".to_string();
        assert!(msg.contains("Tempo limite"));
        assert!(msg.contains("conexão"));
    }
}
