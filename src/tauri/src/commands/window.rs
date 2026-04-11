use tauri::{AppHandle, Manager, WebviewWindow};

/// Filename under app_data_dir used to persist the overlay window position
/// across restarts.
const OVERLAY_POSITION_FILE: &str = "overlay-position.json";

/// Writes `{x, y}` to `<app_data_dir>/overlay-position.json`. Failures are
/// swallowed on purpose — the drag flow must not error out because the disk
/// is momentarily unavailable; the overlay will simply start at the default
/// position on next launch.
fn persist_overlay_position(app: &AppHandle, x: i32, y: i32) {
    let Ok(dir) = app.path().app_data_dir() else {
        return;
    };
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }
    let content = serde_json::json!({ "x": x, "y": y }).to_string();
    let _ = std::fs::write(dir.join(OVERLAY_POSITION_FILE), content);
}

/// Loads the persisted overlay position, if any. Returns `None` when the file
/// is missing, unreadable, or malformed.
pub fn load_overlay_position(app: &AppHandle) -> Option<(i32, i32)> {
    let dir = app.path().app_data_dir().ok()?;
    let content = std::fs::read_to_string(dir.join(OVERLAY_POSITION_FILE)).ok()?;
    let value: serde_json::Value = serde_json::from_str(&content).ok()?;
    let x = value.get("x")?.as_i64()? as i32;
    let y = value.get("y")?.as_i64()? as i32;
    Some((x, y))
}

#[tauri::command]
pub fn close_window(window: WebviewWindow) {
    window.hide().ok();
}

#[tauri::command]
pub fn minimize_window(window: WebviewWindow) {
    window.minimize().ok();
}

#[tauri::command]
pub fn resize_window(state: String, window: WebviewWindow) {
    let height: u32 = match state.as_str() {
        "idle" => 60,
        "result" => 420,
        _ => return,
    };
    window
        .set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: 600,
            height,
        }))
        .ok();
}

#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
pub fn overlay_set_position(x: i32, y: i32, app: AppHandle) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay
            .set_position(tauri::PhysicalPosition { x, y })
            .ok();
    }
    persist_overlay_position(&app, x, y);
}

#[tauri::command]
pub fn overlay_drag_start() {
    // no-op — drag state is managed in the renderer
}

/// Restarts the application to apply a downloaded update. Called by the
/// renderer after `update:downloaded` is received.
#[tauri::command]
pub fn install_update(app: AppHandle) {
    app.restart();
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_resize_state_mapping() {
        let height_idle: u32 = match "idle" {
            "idle" => 60,
            "result" => 420,
            _ => 0,
        };
        let height_result: u32 = match "result" {
            "idle" => 60,
            "result" => 420,
            _ => 0,
        };
        assert_eq!(height_idle, 60);
        assert_eq!(height_result, 420);
    }

    #[test]
    fn test_resize_invalid_state_ignored() {
        let height: Option<u32> = match "unknown" {
            "idle" => Some(60),
            "result" => Some(420),
            _ => None,
        };
        assert!(height.is_none());
    }

    #[test]
    fn test_overlay_drag_start_is_noop() {
        super::overlay_drag_start();
    }

    #[test]
    fn test_overlay_position_json_roundtrip() {
        // Verifies that the format we write is the format we read back.
        let content = serde_json::json!({ "x": 123, "y": 456 }).to_string();
        let value: serde_json::Value = serde_json::from_str(&content).unwrap();
        let x = value.get("x").unwrap().as_i64().unwrap() as i32;
        let y = value.get("y").unwrap().as_i64().unwrap() as i32;
        assert_eq!((x, y), (123, 456));
    }

    #[test]
    fn test_overlay_position_parse_rejects_malformed() {
        let content = r#"{"x": "not a number", "y": 0}"#;
        let value: serde_json::Value = serde_json::from_str(content).unwrap();
        // as_i64 should fail for a string — load returns None in that case.
        assert!(value.get("x").and_then(|v| v.as_i64()).is_none());
    }

    #[test]
    fn test_overlay_position_parse_missing_key() {
        let content = r#"{"x": 100}"#;
        let value: serde_json::Value = serde_json::from_str(content).unwrap();
        assert!(value.get("y").is_none());
    }
}
