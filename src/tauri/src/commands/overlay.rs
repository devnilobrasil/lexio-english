// src/tauri/src/commands/overlay.rs
//
// Overlay translate flow — triggered by `Ctrl+Alt+T` global shortcut or by
// the overlay button double-click (which invokes `overlay_translate`).
//
// Steps:
//   1. Capture the current OS selection via Ctrl+C (sync, offloaded with
//      spawn_blocking to keep the tokio runtime responsive).
//   2. Read the user's Gemini API key from SQLite.
//   3. Call `ai_client::fetch_translation`.
//   4. Inject the translated text via Ctrl+V into whatever window had focus.
//   5. Emit state transitions to the overlay: idle → loading → success → idle
//      (or error on any failure).
//
// MutexGuard discipline: we never hold `state.db.lock()` across `.await`.
// Each DB access is scoped in its own `{ }` block.

use tauri::{AppHandle, Emitter, Manager};

use crate::ai_client;
use crate::db::settings as db_settings;
use crate::state::AppState;
use crate::text_bridge::{capture_selection, inject_text};

/// Shared implementation called both from the `overlay_translate` Tauri
/// command and from the `Ctrl+Alt+T` global shortcut handler.
pub async fn do_translate(app: AppHandle) -> Result<(), String> {
    emit_state(&app, "loading");

    // 1. Capture selection on a blocking thread (clipboard + enigo are sync).
    let selected = tokio::task::spawn_blocking(capture_selection)
        .await
        .map_err(|e| format!("spawn_blocking failed: {}", e))?;

    let selected = match selected {
        Ok(Some(text)) => text,
        Ok(None) => {
            emit_state(&app, "idle");
            return Ok(());
        }
        Err(e) => {
            fail(&app, &e);
            return Err(e);
        }
    };

    // 2. Fetch API key (release lock before any await).
    let api_key_opt = {
        let state = app.state::<AppState>();
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db_settings::get_api_key(&conn).map_err(|e| e.to_string())?
    };
    let api_key = match api_key_opt {
        Some(k) => k,
        None => {
            let msg = "API key not configured. Please set it in Settings.".to_string();
            fail(&app, &msg);
            return Err(msg);
        }
    };

    // 3. Clone the HTTP client (cheap — it's Arc-based internally) so we
    //    don't have to hold the state reference across the await.
    let http = {
        let state = app.state::<AppState>();
        state.http.clone()
    };

    let translated = match ai_client::fetch_translation(&http, &api_key, &selected).await {
        Ok(t) => t,
        Err(e) => {
            fail(&app, &e);
            return Err(e);
        }
    };

    // 4. Inject translated text on a blocking thread.
    let translated_for_inject = translated.clone();
    let inject_result = tokio::task::spawn_blocking(move || inject_text(&translated_for_inject))
        .await
        .map_err(|e| format!("spawn_blocking failed: {}", e))?;

    if let Err(e) = inject_result {
        fail(&app, &e);
        return Err(e);
    }

    // 5. Success feedback: show "success" for 2s then return to idle.
    emit_state(&app, "success");
    tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
    emit_state(&app, "idle");

    Ok(())
}

#[tauri::command]
pub async fn overlay_translate(app: AppHandle) -> Result<(), String> {
    do_translate(app).await
}

fn emit_state(app: &AppHandle, state: &str) {
    app.emit_to("overlay", "overlay:state", state).ok();
}

fn emit_error(app: &AppHandle, message: &str) {
    app.emit_to("overlay", "overlay:error", message).ok();
}

fn fail(app: &AppHandle, message: &str) {
    emit_state(app, "error");
    emit_error(app, message);
}
