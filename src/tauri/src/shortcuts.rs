use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

pub fn register_all(app: &tauri::AppHandle) {
    register_main_toggle(app);
    register_overlay_toggle(app);
}

fn register_main_toggle(app: &tauri::AppHandle) {
    let app_handle = app.clone();
    let shortcut = if cfg!(target_os = "macos") {
        "Command+Alt+E"
    } else {
        "Control+Alt+E"
    };

    app.global_shortcut()
        .on_shortcut(shortcut, move |_, _, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            let Some(win) = app_handle.get_webview_window("main") else {
                return;
            };
            if win.is_visible().unwrap_or(false) && win.is_focused().unwrap_or(false) {
                win.set_skip_taskbar(true).ok();
                win.minimize().ok();
            } else if win.is_minimized().unwrap_or(false) {
                win.set_skip_taskbar(false).ok();
                win.unminimize().ok();
                win.set_focus().ok();
            } else {
                reposition_to_cursor_screen(&app_handle, &win);
                win.set_skip_taskbar(false).ok();
                win.show().ok();
                win.set_focus().ok();
            }
        })
        .ok();
}

fn register_overlay_toggle(app: &tauri::AppHandle) {
    let app_handle = app.clone();
    let shortcut = if cfg!(target_os = "macos") {
        "Command+Alt+O"
    } else {
        "Control+Alt+O"
    };

    app.global_shortcut()
        .on_shortcut(shortcut, move |_, _, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            let Some(overlay) = app_handle.get_webview_window("overlay") else {
                return;
            };
            if overlay.is_visible().unwrap_or(false) {
                overlay.hide().ok();
            } else {
                overlay.show().ok();
            }
        })
        .ok();
}

fn reposition_to_cursor_screen(app: &tauri::AppHandle, win: &tauri::WebviewWindow) {
    // Try to position on current monitor; fallback to primary if unavailable
    let monitor = win
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());

    if let Some(monitor) = monitor {
        let size = monitor.size();
        let pos = monitor.position();
        let win_size = win
            .outer_size()
            .unwrap_or(tauri::PhysicalSize { width: 600, height: 60 });
        let x = pos.x + (size.width as i32 - win_size.width as i32) / 2;
        let y = pos.y + (size.height as i32 / 4);
        win.set_position(tauri::PhysicalPosition { x, y }).ok();
    }
}
