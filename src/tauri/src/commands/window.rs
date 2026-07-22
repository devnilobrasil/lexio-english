// src/tauri/src/commands/window.rs
use tauri::{AppHandle, WebviewWindow};

pub fn height_for_state(state: &str) -> Option<u32> {
    match state {
        "idle" => Some(110),
        "result" => Some(420),
        "translate" => Some(320),
        _ => None,
    }
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
    let Some(height) = height_for_state(&state) else {
        return;
    };
    window
        .set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: 720,
            height,
        }))
        .ok();
}

#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Restarts the application to apply a downloaded update.
#[tauri::command]
pub fn install_update(app: AppHandle) {
    app.restart();
}

#[cfg(test)]
mod tests {
    use super::height_for_state;

    #[test]
    fn test_resize_state_mapping() {
        assert_eq!(height_for_state("idle"), Some(110));
        assert_eq!(height_for_state("result"), Some(420));
        assert_eq!(height_for_state("translate"), Some(320));
    }

    #[test]
    fn test_resize_invalid_state_ignored() {
        assert_eq!(height_for_state("unknown"), None);
    }
}
