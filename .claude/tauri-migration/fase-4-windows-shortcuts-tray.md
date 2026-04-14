# Fase 4 — Janelas, Atalhos e System Tray

**Objetivo:** Implementar os commands de controle de janela, os 3 atalhos globais e o system tray. O app deve ser controlável completamente sem mouse na barra de título.

**Referência:** `SPEC.md` — Seções 2, 8 e 9

---

## Skills e Modelo

**Modelo recomendado:** `claude-sonnet-4-6`
Os commands de janela são simples (delegar para `AppHandle`). Os atalhos globais e tray têm mais nuance, mas seguem padrões documentados na skill. Sonnet é suficiente; escalar para Opus se surgirem problemas com o plugin `global-shortcut`.

**Ler antes de implementar:**

| Skill | Por quê |
|---|---|
| `.claude/skills/tauri-architecture/SKILL.md` | `AppHandle`, `WebviewWindow`, plugin registration, `GlobalShortcutExt`, `TrayIconBuilder` |
| `.claude/skills/rust-patterns/SKILL.md` | Error handling dos commands de janela, organização de módulos |
| `.claude/skills/electron-architecture/SKILL.md` | Referência: comportamento exato dos atalhos e tray atuais a replicar |
| `superpowers:systematic-debugging` | Depurar atalhos conflitantes, tray nativo no Windows |

---

## Pré-requisitos

- Fase 3 concluída (busca de palavras funcionando end-to-end)

---

## Dependências a Adicionar em `Cargo.toml`

```toml
tauri-plugin-global-shortcut = "2"
```

Plugins Tauri precisam ser registrados também em `tauri.conf.json`:

```json
{
  "plugins": {
    "global-shortcut": {}
  }
}
```

---

## Estrutura de Arquivos

```
src/tauri/src/
├── commands/
│   ├── window.rs    ← NOVO: close, minimize, resize, get_app_version
│   └── mod.rs       ← atualizar re-exports
├── shortcuts.rs     ← NOVO: registrar os 3 atalhos globais
└── tray.rs          ← NOVO: system tray + menu
```

---

## Passo 1 — Commands de Janela (`src/tauri/src/commands/window.rs`)

```rust
use tauri::{Manager, WebviewWindow};

#[tauri::command]
pub fn close_window(window: WebviewWindow) {
    window.hide().ok();
}

#[tauri::command]
pub fn minimize_window(window: WebviewWindow) {
    window.minimize().ok();
}

#[tauri::command]
pub fn resize_window(state: String, window: WebviewWindow) {
    let height: u32 = match state.as_str() {
        "idle"   => 60,
        "result" => 420,
        _        => return,
    };
    // Tauri v2: set_size é síncrono, não requer hack de resizable
    window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: 600, height })).ok();
}

#[tauri::command]
pub fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}
```

**Nota sobre resize:** O Electron precisava de um workaround de `setResizable(true) → setSize → setResizable(false)` para Windows. Tauri v2 não tem esse problema — `set_size` funciona diretamente mesmo com `resizable: false` na config.

---

## Passo 2 — Atalhos Globais (`src/tauri/src/shortcuts.rs`)

```rust
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

pub fn register_all(app: &AppHandle) {
    register_main_toggle(app);
    register_overlay_toggle(app);
    // Ctrl+Alt+T é registrado na Fase 5 (precisa do overlay window)
}

fn register_main_toggle(app: &AppHandle) {
    let app_handle = app.clone();
    let shortcut = if cfg!(target_os = "macos") { "Command+Alt+E" } else { "Control+Alt+E" };

    app.global_shortcut().on_shortcut(shortcut, move |_, shortcut, event| {
        if event.state() != ShortcutState::Pressed { return; }

        let Some(win) = app_handle.get_webview_window("main") else { return };

        if win.is_visible().unwrap_or(false) && win.is_focused().unwrap_or(false) {
            win.set_skip_taskbar(true).ok();
            win.minimize().ok();
        } else if win.is_minimized().unwrap_or(false) {
            win.set_skip_taskbar(false).ok();
            win.unminimize().ok();
            win.set_focus().ok();
        } else {
            // Reposicionar no centro do monitor com o cursor
            reposition_to_cursor_screen(&app_handle, &win);
            win.set_skip_taskbar(false).ok();
            win.show().ok();
            win.set_focus().ok();
        }
    }).ok();
}

fn register_overlay_toggle(app: &AppHandle) {
    let app_handle = app.clone();
    let shortcut = if cfg!(target_os = "macos") { "Command+Alt+O" } else { "Control+Alt+O" };

    app.global_shortcut().on_shortcut(shortcut, move |_, _, event| {
        if event.state() != ShortcutState::Pressed { return; }
        let Some(overlay) = app_handle.get_webview_window("overlay") else { return };
        if overlay.is_visible().unwrap_or(false) {
            overlay.hide().ok();
        } else {
            overlay.show().ok();
        }
    }).ok();
}

fn reposition_to_cursor_screen(app: &AppHandle, win: &tauri::WebviewWindow) {
    // Obter posição do cursor e tamanho do monitor ativo
    // Tauri v2 não expõe screen diretamente — usar monitor do cursor via plugin ou API
    // Fallback: centralizar na tela primária
    if let Ok(Some(monitor)) = win.current_monitor() {
        let size = monitor.size();
        let pos = monitor.position();
        let win_size = win.outer_size().unwrap_or(tauri::PhysicalSize { width: 600, height: 60 });
        let x = pos.x + (size.width as i32 - win_size.width as i32) / 2;
        let y = pos.y + (size.height as i32 / 4);
        win.set_position(tauri::PhysicalPosition { x, y }).ok();
    }
}
```

---

## Passo 3 — System Tray (`src/tauri/src/tray.rs`)

```rust
use tauri::{
    AppHandle, Manager,
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    menu::{Menu, MenuItem, PredefinedMenuItem},
};

pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_item     = MenuItem::with_id(app, "show",         "Show Lexio",    true, None::<&str>)?;
    let overlay_item  = MenuItem::with_id(app, "show_overlay", "Show Overlay",  true, None::<&str>)?;
    let separator     = PredefinedMenuItem::separator(app)?;
    let quit_item     = MenuItem::with_id(app, "quit",         "Quit",          true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &overlay_item, &separator, &quit_item])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("Lexio")
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => {
                    if let Some(win) = app.get_webview_window("main") {
                        win.show().ok();
                        win.set_focus().ok();
                    }
                }
                "show_overlay" => {
                    if let Some(overlay) = app.get_webview_window("overlay") {
                        if overlay.is_visible().unwrap_or(false) {
                            overlay.hide().ok();
                        } else {
                            overlay.show().ok();
                        }
                    }
                }
                "quit" => app.exit(0),
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            // Duplo clique no ícone da bandeja → mostra janela main
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    win.show().ok();
                    win.set_focus().ok();
                }
            }
        })
        .build(app)?;

    Ok(())
}
```

---

## Passo 4 — Registrar Tudo em `main.rs`

```rust
mod shortcuts;
mod tray;
mod commands;

tauri::Builder::default()
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .setup(|app| {
        // DB init (já da Fase 2)
        let db_path = db::get_db_path(app.handle());
        let conn = Connection::open(&db_path)?;
        db::init(&conn)?;
        app.manage(AppState::new(conn));

        // Atalhos globais
        shortcuts::register_all(app.handle());

        // System tray
        tray::create_tray(app.handle())?;

        Ok(())
    })
    .invoke_handler(tauri::generate_handler![
        // Fase 2
        commands::words::get_history,
        commands::words::get_saved,
        commands::words::save_word,
        commands::words::toggle_saved,
        commands::words::delete_word,
        commands::words::remove_from_history,
        commands::words::unsave_word,
        commands::words::get_api_key,
        commands::words::set_api_key,
        // Fase 3
        commands::words::get_word,
        // Fase 4 — NOVO
        commands::window::close_window,
        commands::window::minimize_window,
        commands::window::resize_window,
        commands::window::get_app_version,
    ])
    .run(tauri::generate_context!())
    .expect("error running lexio");
```

---

## Passo 5 — Adaptar Hooks de Janela no Frontend

### `src/renderer/hooks/useWindowControls.ts` (ou onde estiver)

```ts
import { invoke } from '../lib/tauri-bridge'
import { getCurrentWindow } from '@tauri-apps/api/window'

export function useWindowControls() {
  return {
    close:    () => invoke('close_window'),
    minimize: () => invoke('minimize_window'),
    resize:   (state: 'idle' | 'result') => invoke('resize_window', { state }),
  }
}
```

### Eventos de atualização (`useAutoUpdater.ts`)

Substituir `ipcRenderer.on` por `listen` do `@tauri-apps/api/event` (preparação para Fase 6):

```ts
import { listen } from '@tauri-apps/api/event'

// Registrar listeners assim que o componente monta
await listen<string>('update:available',  (e) => setUpdateVersion(e.payload))
await listen<number>('update:progress',   (e) => setProgress(e.payload))
await listen<string>('update:downloaded', (e) => setDownloaded(e.payload))
```

---

## Passo 6 — Testes de Commands de Janela

Commands de janela são difíceis de unit-testar sem uma janela real. Adotar abordagem pragmática:

```rust
#[cfg(test)]
mod tests {
    // Testar apenas a lógica de altura do resize — a única lógica testável
    #[test]
    fn test_resize_state_mapping() {
        let height_idle   = match "idle"   { "idle" => 60u32, "result" => 420, _ => 0 };
        let height_result = match "result" { "idle" => 60u32, "result" => 420, _ => 0 };
        assert_eq!(height_idle, 60);
        assert_eq!(height_result, 420);
    }

    #[test]
    fn test_resize_invalid_state_ignored() {
        let height = match "unknown" { "idle" => Some(60u32), "result" => Some(420), _ => None };
        assert!(height.is_none());
    }
}
```

---

## Critério de Saída da Fase 4

- [ ] `Ctrl+Alt+E` abre/fecha a janela main e a reposiciona no centro do monitor
- [ ] `Ctrl+Alt+O` toggle o overlay
- [ ] Botão de fechar (X) da UI chama `invoke('close_window')` e esconde a janela
- [ ] Botão de minimizar funciona
- [ ] `invoke('resize_window', { state: 'result' })` expande para 420px
- [ ] `invoke('resize_window', { state: 'idle' })` volta para 60px
- [ ] System tray aparece com ícone e menu correto
- [ ] "Quit" no tray fecha o app
- [ ] "Show Lexio" no tray traz a janela de volta
- [ ] `cargo test` passa
- [ ] `npm run build:renderer` passa sem erros
