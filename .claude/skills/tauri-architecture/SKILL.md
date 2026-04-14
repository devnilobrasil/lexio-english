---
name: tauri-architecture
description: Use when implementing any IPC, window management, events, or plugin integration in a Tauri v2 project. Use when replacing Electron contextBridge patterns, adding global shortcuts, or emitting events between backend and renderer.
---

# Tauri v2 Architecture Patterns

## Overview

Tauri v2 IPC uses `invoke()` (renderer → backend) and `emit()`/`listen()` (backend → renderer). There is no preload or contextBridge. Commands are Rust functions annotated with `#[tauri::command]` and registered in `main.rs`.

---

## Command Signatures

### Sync command (DB-only, no external I/O)
```rust
#[tauri::command]
pub fn get_saved(locale: String, state: State<'_, AppState>) -> Result<Vec<Word>, String>
```

### Async command (HTTP, file I/O, sleep)
```rust
#[tauri::command]
pub async fn get_word(
    word: String,
    locale: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Option<Word>, String>
```

**Rule: any command that calls `.await` must be `async fn`.**

### Parameter injection (Tauri auto-injects these — do NOT pass from renderer)
| Parameter | Type | What it provides |
|---|---|---|
| Shared state | `State<'_, AppState>` | Your AppState (DB, HTTP client) |
| App handle | `AppHandle` | Emit events, get other windows, access paths |
| Window | `WebviewWindow` | The calling window (resize, hide, show) |

---

## Critical Rule — No MutexGuard Across `await`

```rust
// ❌ DEADLOCK — MutexGuard held across await
pub async fn bad(state: State<'_, AppState>) -> Result<String, String> {
    let conn = state.db.lock().unwrap(); // lock held
    let result = http_call().await;      // await while locked → deadlock
    Ok(result)
}

// ✅ CORRECT — drop the guard before awaiting
pub async fn good(state: State<'_, AppState>) -> Result<String, String> {
    let cached = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db::get_word(&conn, "foo")? // guard dropped at end of block
    };
    let result = http_call().await; // no lock held here
    Ok(result)
}
```

---

## Registering Commands

```rust
// main.rs
tauri::Builder::default()
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .setup(|app| {
        app.manage(AppState::new(conn));
        Ok(())
    })
    .invoke_handler(tauri::generate_handler![
        commands::words::get_word,      // async
        commands::words::get_history,   // sync
        commands::window::resize_window,
    ])
    .run(tauri::generate_context!())
    .expect("error running app");
```

---

## Renderer — invoke() and listen()

```ts
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

// Calling a command (camelCase JS → snake_case Rust)
const word = await invoke<Word | null>('get_word', { word: 'churn', locale: 'pt-BR' })

// Listening to backend events (cleanup on unmount)
useEffect(() => {
  const unlisten = listen<string>('update:available', (e) => {
    setVersion(e.payload)
  })
  return () => { unlisten.then(fn => fn()) }
}, [])
```

**Naming convention:** `getWord` (TS) ↔ `get_word` (Rust command name). Tauri maps automatically.

---

## Event Emission (Backend → Renderer)

```rust
// To a specific window
app.emit_to("main", "update:available", &version).ok();
app.emit_to("overlay", "overlay:state", "loading").ok();

// To all windows
app.emit("some:event", payload).ok();

// From within a command (use AppHandle parameter)
#[tauri::command]
pub async fn trigger_translate(app: AppHandle, ...) {
    app.emit_to("overlay", "overlay:state", "loading").ok();
}
```

---

## Window Management

```rust
// Get any window by label
let win = app.get_webview_window("main").unwrap();
let overlay = app.get_webview_window("overlay").unwrap();

// Common operations
win.hide().ok();
win.show().ok();
win.set_focus().ok();
win.minimize().ok();
win.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: 600, height: 420 })).ok();
win.set_position(tauri::PhysicalPosition { x: 100, y: 200 }).ok();
win.set_always_on_top(true).ok();
win.is_visible().unwrap_or(false)
win.is_focused().unwrap_or(false)
```

---

## Plugin Registration Pattern

```toml
# Cargo.toml
[dependencies]
tauri-plugin-global-shortcut = "2"
tauri-plugin-updater = "2"
```

```json
// tauri.conf.json
{
  "plugins": {
    "global-shortcut": [],
    "updater": { "pubkey": "...", "endpoints": ["..."] }
  }
}
```

```rust
// main.rs — each plugin registered before .setup()
tauri::Builder::default()
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_updater::Builder::new().build())
```

---

## Global Shortcuts

```rust
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

app.global_shortcut().on_shortcut("Control+Alt+E", move |_, _, event| {
    if event.state() != ShortcutState::Pressed { return; }
    // handle shortcut
}).ok();
```

For async work inside a shortcut handler:
```rust
tauri::async_runtime::spawn(async move {
    do_async_work().await;
});
```

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| MutexGuard across `await` | Drop lock in inner block before awaiting |
| Forgetting `async` on command with I/O | Add `async fn` |
| Passing `AppHandle`/`Window` from JS | These are injected by Tauri, not passed from renderer |
| `invoke('getWord', ...)` | Must be `invoke('get_word', ...)` — snake_case |
| Using `window.emit()` to all windows | Use `app.emit_to("label", ...)` for targeted emission |
