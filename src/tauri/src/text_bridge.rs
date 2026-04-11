// src/tauri/src/text_bridge.rs
//
// Clipboard capture + keyboard injection used by the overlay translate flow.
//
// TRADEOFF vs selection-hook (Electron):
// - selection-hook was passive (UIAutomation, no keypress). We can't replicate
//   that without a Windows-specific Rust binding. Instead we simulate Ctrl+C,
//   which may have side-effects in apps that intercept that shortcut.
// - The previous clipboard content is preserved (restored after the read/write).

use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::thread;
use std::time::Duration;

/// Delay between pressing Ctrl+C and reading the clipboard. Tuned empirically
/// on Windows — too short and some apps haven't populated the clipboard yet.
const COPY_SETTLE_MS: u64 = 80;

/// Delay between writing the clipboard and pressing Ctrl+V.
const PASTE_PREP_MS: u64 = 60;

/// Delay after Ctrl+V to let the target app consume the clipboard before we
/// restore the original content.
const PASTE_SETTLE_MS: u64 = 80;

/// Captures the text currently selected in the foreground window by
/// simulating Ctrl+C and reading the clipboard.
///
/// Returns `Ok(None)` when there was nothing selected (or the selection was
/// only whitespace). Restores the previous clipboard content before returning.
pub fn capture_selection() -> Result<Option<String>, String> {
    let mut clipboard =
        Clipboard::new().map_err(|e| format!("Failed to open clipboard: {}", e))?;

    // Snapshot current clipboard so we can restore it later.
    let previous = clipboard.get_text().ok();

    // Simulate Ctrl+C on the foreground window.
    let mut enigo =
        Enigo::new(&Settings::default()).map_err(|e| format!("Failed to init enigo: {}", e))?;

    enigo
        .key(Key::Control, Direction::Press)
        .map_err(|e| format!("enigo error: {}", e))?;
    enigo
        .key(Key::Unicode('c'), Direction::Click)
        .map_err(|e| format!("enigo error: {}", e))?;
    enigo
        .key(Key::Control, Direction::Release)
        .map_err(|e| format!("enigo error: {}", e))?;

    thread::sleep(Duration::from_millis(COPY_SETTLE_MS));

    let selected = clipboard
        .get_text()
        .ok()
        .filter(|s| !s.trim().is_empty());

    // Restore the previous clipboard unless nothing was there before.
    // We skip restore when `selected` already equals `previous` (nothing
    // actually changed) to avoid a redundant write.
    if let Some(prev) = previous {
        if selected.as_deref() != Some(prev.as_str()) {
            clipboard.set_text(prev).ok();
        }
    }

    Ok(selected)
}

/// Writes `text` to the clipboard, simulates Ctrl+V, then restores whatever
/// was previously in the clipboard.
pub fn inject_text(text: &str) -> Result<(), String> {
    let mut clipboard =
        Clipboard::new().map_err(|e| format!("Failed to open clipboard: {}", e))?;

    let previous = clipboard.get_text().ok();

    clipboard
        .set_text(text.to_string())
        .map_err(|e| format!("Failed to set clipboard: {}", e))?;

    thread::sleep(Duration::from_millis(PASTE_PREP_MS));

    let mut enigo =
        Enigo::new(&Settings::default()).map_err(|e| format!("Failed to init enigo: {}", e))?;

    enigo
        .key(Key::Control, Direction::Press)
        .map_err(|e| format!("enigo error: {}", e))?;
    enigo
        .key(Key::Unicode('v'), Direction::Click)
        .map_err(|e| format!("enigo error: {}", e))?;
    enigo
        .key(Key::Control, Direction::Release)
        .map_err(|e| format!("enigo error: {}", e))?;

    thread::sleep(Duration::from_millis(PASTE_SETTLE_MS));

    // Restore previous clipboard (best-effort).
    if let Some(prev) = previous {
        clipboard.set_text(prev).ok();
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_delay_constants_are_reasonable() {
        // Sanity: delays must be positive and under 1s so the flow stays snappy.
        assert!(COPY_SETTLE_MS > 0 && COPY_SETTLE_MS < 1000);
        assert!(PASTE_PREP_MS > 0 && PASTE_PREP_MS < 1000);
        assert!(PASTE_SETTLE_MS > 0 && PASTE_SETTLE_MS < 1000);
    }

    // Real clipboard/enigo behaviour is OS-dependent (and requires a display),
    // so the full capture/inject flow is verified manually per the Phase 5
    // integration checklist in .claude/tauri-migration/fase-5-overlay-translation.md
}
