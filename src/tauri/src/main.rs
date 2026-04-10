#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai_client;
mod commands;
mod db;
mod state;
mod types;

use rusqlite::Connection;
use state::AppState;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let db_path = db::get_db_path(app.handle());
            if let Some(parent) = db_path.parent() {
                std::fs::create_dir_all(parent).expect("failed to create app data dir");
            }
            let conn = Connection::open(&db_path).expect("failed to open database");
            db::init(&conn).expect("failed to initialize database");
            app.manage(AppState::new(conn));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::words::get_word,
            commands::words::get_history,
            commands::words::get_saved,
            commands::words::save_word,
            commands::words::toggle_saved,
            commands::words::delete_word,
            commands::words::remove_from_history,
            commands::words::unsave_word,
            commands::words::get_api_key,
            commands::words::set_api_key,
            commands::words::get_app_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
