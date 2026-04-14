// src/tauri/src/commands/overlay.rs
//
// Overlay helpers — emit functions for overlay state management.
// The old `overlay_translate` / `do_translate` flow was removed as part of
// the inline-translation migration (Phase 1).

use tauri::{AppHandle, Emitter};

#[allow(dead_code)]
pub fn emit_state(app: &AppHandle, state: &str) {
    app.emit_to("overlay", "overlay:state", state).ok();
}

#[allow(dead_code)]
pub fn emit_error(app: &AppHandle, message: &str) {
    app.emit_to("overlay", "overlay:error", message).ok();
}

#[allow(dead_code)]
pub fn fail(app: &AppHandle, message: &str) {
    emit_state(app, "error");
    emit_error(app, message);
}
