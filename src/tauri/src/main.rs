#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai_client;
mod commands;
mod db;
mod shortcuts;
mod state;
mod text_bridge;
mod tray;
mod types;
mod updater;

use rusqlite::Connection;
use state::AppState;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let db_path = db::get_db_path(app.handle());
            if let Some(parent) = db_path.parent() {
                std::fs::create_dir_all(parent).expect("failed to create app data dir");
            }
            let conn = Connection::open(&db_path).expect("failed to open database");
            db::init(&conn).expect("failed to initialize database");
            app.manage(AppState::new(conn));

            // Restore the overlay window position saved on the previous run.
            if let Some((x, y)) = commands::window::load_overlay_position(app.handle()) {
                if let Some(overlay) = app.get_webview_window("overlay") {
                    overlay.set_position(tauri::PhysicalPosition { x, y }).ok();
                }
            }

            shortcuts::register_all(app.handle());
            tray::create_tray(app.handle())?;

            // Check for updates in background — no-op in dev mode (not packaged)
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                updater::check_and_setup(app_handle).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Phase 2 — DB + Settings
            commands::words::get_history,
            commands::words::get_saved,
            commands::words::save_word,
            commands::words::toggle_saved,
            commands::words::delete_word,
            commands::words::remove_from_history,
            commands::words::unsave_word,
            commands::words::get_api_key,
            commands::words::set_api_key,
            // Phase 3 — AI (async)
            commands::words::get_word,
            // Phase 4 — Window controls
            commands::window::close_window,
            commands::window::minimize_window,
            commands::window::resize_window,
            commands::window::get_app_version,
            commands::window::overlay_set_position,
            commands::window::overlay_drag_start,
            // Phase 5 — Overlay translate flow
            commands::overlay::overlay_translate,
            // Phase 6 — Auto-updater
            commands::window::install_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
