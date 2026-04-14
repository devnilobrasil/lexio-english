// src/tauri/src/selection_watcher.rs
//
// Global mouse listener that detects text selections in any window.
// Uses WH_MOUSE_LL (Windows low-level mouse hook) directly — intentionally
// avoids rdev because rdev::listen() also installs WH_KEYBOARD_LL, which
// runs in a thread with a different keyboard layout context and causes the
// system keyboard layout to appear different in other applications (e.g.
// ABNT2/pt-BR keys mapping incorrectly while the app is open).
//
// Gate: only emits overlay:text-selected when text is NOT English.

use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

use crate::lang_detect;
use crate::state::AppState;
use crate::text_bridge;
use crate::types::{PendingSuggestion, TextSelectedPayload};

// ─── Timing constants ───────────────────────────────────────────────────────

/// Minimum drag distance to consider as a selection (pixels).
const MIN_DRAG_PX: f64 = 5.0;

/// Debounce between consecutive captures.
const DEBOUNCE_MS: u64 = 300;

/// Delay after MouseUp for the OS to process the selection.
const SETTLE_MS: u64 = 120;

/// Minimum length of selected text.
const MIN_TEXT_LEN: usize = 2;

/// Maximum text length (MVP).
const MAX_TEXT_LEN: usize = 500;

// ─── Pure testable function ─────────────────────────────────────────────────

/// Decides whether to attempt a capture given a drag distance and time since
/// the last capture. Extracted as a pure function for testability.
pub fn should_attempt_capture(drag_distance: f64, since_last_capture: Duration) -> bool {
    drag_distance >= MIN_DRAG_PX && since_last_capture >= Duration::from_millis(DEBOUNCE_MS)
}

// ─── Capture logic ──────────────────────────────────────────────────────────

fn handle_potential_selection(app: AppHandle, cursor_x: f64, cursor_y: f64) {
    // Wait for the OS to process the selection
    std::thread::sleep(Duration::from_millis(SETTLE_MS));

    // Capture selected text
    let captured = match text_bridge::capture_selection() {
        Ok(Some(text)) => text,
        _ => return,
    };

    if captured.trim().len() < MIN_TEXT_LEN {
        return;
    }
    if captured.len() > MAX_TEXT_LEN {
        return;
    }

    // Language gate: don't show suggestion for English text
    if lang_detect::is_likely_english(&captured) {
        return;
    }

    // Store in AppState for Phase 3 suggestion_request command
    let state = app.state::<AppState>();
    match state.pending_suggestion.lock() {
        Ok(mut guard) => {
            *guard = Some(PendingSuggestion {
                original_text: captured.clone(),
                captured_at: Instant::now(),
                cursor_x: cursor_x as i32,
                cursor_y: cursor_y as i32,
            });
        }
        Err(e) => {
            eprintln!("[selection_watcher] failed to lock pending_suggestion: {}", e);
            return;
        }
    }

    app.emit(
        "overlay:text-selected",
        TextSelectedPayload {
            text: captured,
            x: cursor_x as i32,
            y: cursor_y as i32,
        },
    )
    .ok();
}

// ─── Windows mouse-only hook ─────────────────────────────────────────────────

/// Shared state passed through the hook via SetWindowsHookExW's lpfn closure.
/// We use a thread-local to avoid the unsafe pointer dance.
#[cfg(target_os = "windows")]
mod win_hook {
    use super::*;
    use std::cell::RefCell;
    use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, GetMessageW, HHOOK, MSG, SetWindowsHookExW,
        HC_ACTION, WH_MOUSE_LL, WM_LBUTTONDOWN, WM_LBUTTONUP, MSLLHOOKSTRUCT,
    };

    struct HookState {
        app: AppHandle,
        down_pos: Option<(f64, f64)>,
        last_capture_at: Instant,
    }

    thread_local! {
        static HOOK_STATE: RefCell<Option<HookState>> = RefCell::new(None);
    }

    unsafe extern "system" fn mouse_proc(
        n_code: i32,
        w_param: WPARAM,
        l_param: LPARAM,
    ) -> LRESULT {
        if n_code == HC_ACTION as i32 {
            let info = &*(l_param.0 as *const MSLLHOOKSTRUCT);
            let x = info.pt.x as f64;
            let y = info.pt.y as f64;

            HOOK_STATE.with(|cell| {
                let mut opt = cell.borrow_mut();
                if let Some(ref mut state) = *opt {
                    match w_param.0 as u32 {
                        WM_LBUTTONDOWN => {
                            state.down_pos = Some((x, y));
                        }
                        WM_LBUTTONUP => {
                            if let Some((dx, dy)) = state.down_pos.take() {
                                let dist = ((x - dx).powi(2) + (y - dy).powi(2)).sqrt();
                                if should_attempt_capture(dist, state.last_capture_at.elapsed()) {
                                    state.last_capture_at = Instant::now();
                                    let app = state.app.clone();
                                    std::thread::spawn(move || {
                                        handle_potential_selection(app, x, y);
                                    });
                                }
                            }
                        }
                        _ => {}
                    }
                }
            });
        }

        CallNextHookEx(HHOOK::default(), n_code, w_param, l_param)
    }

    pub fn run(app: AppHandle) {
        // Initialise thread-local state before installing the hook
        HOOK_STATE.with(|cell| {
            *cell.borrow_mut() = Some(HookState {
                app,
                down_pos: None,
                last_capture_at: Instant::now()
                    .checked_sub(Duration::from_secs(10))
                    .unwrap_or_else(Instant::now),
            });
        });

        unsafe {
            // WH_MOUSE_LL only — no keyboard hook installed
            let _hook = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_proc), None, 0)
                .expect("[selection_watcher] failed to install WH_MOUSE_LL hook");

            // Message pump required to receive hook callbacks
            let mut msg = MSG::default();
            while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                // No TranslateMessage — we have no keyboard hook and no windows
            }
        }
    }
}

// ─── Main watcher ───────────────────────────────────────────────────────────

/// Starts the background mouse monitoring thread.
/// Call in `setup()` of main.rs after `app.manage(state)`.
pub fn start_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        #[cfg(target_os = "windows")]
        win_hook::run(app);

        #[cfg(not(target_os = "windows"))]
        {
            // Non-Windows fallback — no-op for now
            // Future: AT-SPI (Linux) or Accessibility API (macOS)
            let _ = app;
            eprintln!("[selection_watcher] mouse hook not implemented on this platform");
        }
    });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_drag_is_ignored() {
        assert!(!should_attempt_capture(3.0, Duration::from_millis(500)));
    }

    #[test]
    fn long_drag_within_debounce_is_ignored() {
        assert!(!should_attempt_capture(50.0, Duration::from_millis(100)));
    }

    #[test]
    fn long_drag_after_debounce_is_captured() {
        assert!(should_attempt_capture(50.0, Duration::from_millis(400)));
    }

    #[test]
    fn exact_minimum_drag_is_accepted() {
        assert!(should_attempt_capture(5.0, Duration::from_millis(300)));
    }

    #[test]
    fn below_minimum_drag_is_rejected() {
        assert!(!should_attempt_capture(4.9, Duration::from_millis(1000)));
    }
}
