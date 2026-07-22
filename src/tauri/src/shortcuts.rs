use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::commands::assistant::{classify_selection, SelectionKind};
use crate::lang_detect;
use crate::selection_provider;

pub fn register_all(app: &tauri::AppHandle) {
    register_main_toggle(app);
    register_assistant_translate(app);
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

fn register_assistant_translate(app: &tauri::AppHandle) {
    let app_handle = app.clone();
    let shortcut = if cfg!(target_os = "macos") {
        "Command+Alt+T"
    } else {
        "Control+Alt+T"
    };

    app.global_shortcut()
        .on_shortcut(shortcut, move |_, _, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            let app = app_handle.clone();
            std::thread::spawn(move || {
                handle_assistant_hotkey(app);
            });
        })
        .ok();
}

fn handle_assistant_hotkey(app: tauri::AppHandle) {
    let provider = selection_provider::default_provider();
    let captured = selection_provider::read_selection(provider.as_ref());
    let kind = classify_selection(captured, lang_detect::is_likely_english);

    let Some(win) = app.get_webview_window("main") else {
        return;
    };

    if win.is_minimized().unwrap_or(false) {
        win.unminimize().ok();
    }
    reposition_to_cursor_screen(&app, &win);
    win.set_skip_taskbar(false).ok();
    win.show().ok();
    win.set_focus().ok();

    match kind {
        SelectionKind::Ready(text) => {
            app.emit("assistant:text-ready", serde_json::json!({ "text": text }))
                .ok();
        }
        SelectionKind::English => {
            app.emit("assistant:english-text", ()).ok();
        }
        SelectionKind::Empty | SelectionKind::TooShort | SelectionKind::TooLong => {
            app.emit("assistant:no-selection", ()).ok();
        }
    }
}

pub fn reposition_to_cursor_screen(app: &tauri::AppHandle, win: &tauri::WebviewWindow) {
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
            .unwrap_or(tauri::PhysicalSize {
                width: 720,
                height: 110,
            });
        let x = pos.x + (size.width as i32 - win_size.width as i32) / 2;
        let y = pos.y + (size.height as i32 / 4);
        win.set_position(tauri::PhysicalPosition { x, y }).ok();
    }
}
