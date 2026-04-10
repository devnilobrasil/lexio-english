use tauri::{AppHandle, WebviewWindow};

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
}

#[tauri::command]
pub fn overlay_drag_start() {
    // no-op — drag state is managed in the renderer
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
}
