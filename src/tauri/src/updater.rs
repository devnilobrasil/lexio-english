use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

/// Checks for updates in the background. Only runs in release builds.
/// Silently swallows errors — the user can still use the app if the update
/// check fails (e.g., offline).
pub async fn check_and_setup(app: AppHandle) {
    // Skip in dev mode (debug builds). cfg! is a compile-time check — zero cost.
    if cfg!(debug_assertions) {
        return;
    }

    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            eprintln!("[updater] failed to get updater: {}", e);
            return;
        }
    };

    let update = match updater.check().await {
        Ok(Some(u)) => u,
        Ok(None) => return, // no update available
        Err(e) => {
            eprintln!("[updater] check error: {}", e);
            return;
        }
    };

    // Notify renderer that an update is available
    app.emit_to("main", "update:available", &update.version).ok();

    // Download with progress events
    let app_download = app.clone();
    update
        .download_and_install(
            move |chunk_len, content_len| {
                if let Some(total) = content_len {
                    let pct = (chunk_len as f64 / total as f64 * 100.0).round() as u32;
                    app_download.emit_to("main", "update:progress", pct).ok();
                }
            },
            move || {
                app.emit_to("main", "update:downloaded", "").ok();
            },
        )
        .await
        .ok();
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_updater_module_compiles() {
        // Structural test — verifies the module compiles with its imports.
        assert!(true);
    }
}
