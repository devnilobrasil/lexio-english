#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai_client;
mod commands;
mod db;
mod lang_detect;
mod selection_provider;
mod shortcuts;
mod state;
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

            shortcuts::register_all(app.handle());
            tray::create_tray(app.handle())?;

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                updater::check_and_setup(app_handle).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::words::get_history,
            commands::words::get_saved,
            commands::words::save_word,
            commands::words::toggle_saved,
            commands::words::delete_word,
            commands::words::remove_from_history,
            commands::words::unsave_word,
            commands::words::get_word,
            commands::window::close_window,
            commands::window::minimize_window,
            commands::window::resize_window,
            commands::window::get_app_version,
            commands::window::install_update,
            commands::assistant::assistant_translate,
            commands::assistant::assistant_copy_to_clipboard,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
