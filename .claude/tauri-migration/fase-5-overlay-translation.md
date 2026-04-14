# Fase 5 — Overlay e Fluxo de Tradução

**Objetivo:** Implementar o fluxo completo de tradução: `Ctrl+Alt+T` → captura da seleção via Ctrl+C + arboard → chamada Gemini para tradução → injeção via enigo → feedback de estado para o overlay UI.

**Referência:** `SPEC.md` — Seções 7 e 6 (translate_text)

---

## Skills e Modelo

**Modelo recomendado:** `claude-opus-4-6`
Esta é a fase de maior risco de integração nativa: `enigo` + `arboard` têm comportamento dependente de OS, o fluxo async tem 7 etapas sequenciais com múltiplos pontos de falha, e o timing de Ctrl+C/V é sensível. Usar Opus.

**Ler antes de implementar:**

| Skill | Por quê |
|---|---|
| `.claude/skills/tauri-architecture/SKILL.md` | `emit_to()` para o overlay, `listen()` no renderer, `async fn` com AppHandle |
| `.claude/skills/rust-patterns/SKILL.md` | `thread::sleep` vs `tokio::time::sleep`, error handling em código nativo |
| `.claude/skills/electron-architecture/SKILL.md` | Referência: fluxo atual em `overlay.ts` + `text-bridge.ts` a replicar fielmente |
| `superpowers:systematic-debugging` | Depurar `enigo`, `arboard`, timing de clipboard, side effects do Ctrl+C |

---

## Pré-requisitos

- Fase 4 concluída (atalhos globais funcionando)
- Overlay window renderizando (janela já configurada na Fase 1)

---

## Dependências a Adicionar em `Cargo.toml`

```toml
arboard = "3"
enigo = { version = "0.2", features = [] }
```

---

## Estrutura de Arquivos

```
src/tauri/src/
├── ai_client/
│   ├── mod.rs              ← atualizar: adicionar fetch_translation
│   └── translate_prompt.rs ← NOVO: prompt de tradução
├── text_bridge.rs          ← NOVO: captura + injeção de texto
├── commands/
│   └── overlay.rs          ← NOVO: trigger_translate command
└── shortcuts.rs            ← atualizar: registrar Ctrl+Alt+T
```

---

## Passo 1 — Prompt de Tradução (`src/tauri/src/ai_client/translate_prompt.rs`)

> Portar de `translate.ts` — GROQ [deprecated]. O prompt não muda, apenas o módulo.

```rust
pub const TRANSLATE_SYSTEM_PROMPT: &str =
    "You are a professional translator. Translate the given text to English. \
     Return ONLY the translated text, nothing else — no explanations, no notes, no quotes.";
```

---

## Passo 2 — Função de Tradução no AI Client (`src/tauri/src/ai_client/mod.rs`)

Adicionar ao arquivo existente da Fase 3:

```rust
use crate::ai_client::translate_prompt::TRANSLATE_SYSTEM_PROMPT;
use crate::ai_client::config::{AI_BASE_URL, AI_MODEL};

pub async fn fetch_translation(
    client: &Client,
    api_key: &str,
    text: &str,
) -> Result<String, String> {
    // Tradução retorna texto puro — sem response_format json_object
    let request_plain = serde_json::json!({
        "model": AI_MODEL,                              // "gemini-2.0-flash"
        "messages": [
            { "role": "system", "content": TRANSLATE_SYSTEM_PROMPT },
            { "role": "user",   "content": text }
        ]
    });

    let response = client
        .post(AI_BASE_URL)                              // endpoint Gemini OpenAI-compat
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request_plain)
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Gemini API error {}: {}", status, body));
    }

    let chat: ChatResponse = response.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let content = chat.choices.first()
        .map(|c| c.message.content.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or("Empty response from Gemini translation")?;

    Ok(content)
}
```

---

## Passo 3 — Text Bridge em Rust (`src/tauri/src/text_bridge.rs`)

Replicar o comportamento de `text-bridge.ts`, com o tradeoff documentado:

```rust
use arboard::Clipboard;
use enigo::{Enigo, Key, Keyboard, Settings, Direction};
use std::time::Duration;
use std::thread;

/// Captura o texto atualmente selecionado no OS.
///
/// TRADEOFF vs selection-hook (Electron):
/// - selection-hook era passivo (UIAutomation, sem keypress).
/// - Esta implementação simula Ctrl+C, o que pode ter side effects
///   em apps que interceptam esse atalho. O estado do clipboard é
///   preservado (restaurado após a leitura).
pub fn capture_selection() -> Result<Option<String>, String> {
    let mut clipboard = Clipboard::new()
        .map_err(|e| format!("Failed to open clipboard: {}", e))?;

    // Salvar clipboard atual
    let previous = clipboard.get_text().ok();

    // Simular Ctrl+C para copiar a seleção
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to init enigo: {}", e))?;

    enigo.key(Key::Control, Direction::Press)
        .map_err(|e| format!("enigo error: {}", e))?;
    enigo.key(Key::Unicode('c'), Direction::Click)
        .map_err(|e| format!("enigo error: {}", e))?;
    enigo.key(Key::Control, Direction::Release)
        .map_err(|e| format!("enigo error: {}", e))?;

    // Aguardar o OS processar o Ctrl+C
    thread::sleep(Duration::from_millis(80));

    let selected = clipboard.get_text().ok()
        .filter(|s| !s.trim().is_empty());

    // Restaurar clipboard se havia conteúdo anterior diferente
    if let Some(prev) = previous {
        if selected.as_deref() != Some(&prev) {
            clipboard.set_text(prev).ok();
        }
    }

    Ok(selected)
}

/// Injeta texto na janela ativa via clipboard + Ctrl+V.
/// Preserva o conteúdo do clipboard do usuário.
pub fn inject_text(text: &str) -> Result<(), String> {
    let mut clipboard = Clipboard::new()
        .map_err(|e| format!("Failed to open clipboard: {}", e))?;

    // Salvar clipboard atual
    let previous = clipboard.get_text().ok();

    // Escrever tradução no clipboard
    clipboard.set_text(text)
        .map_err(|e| format!("Failed to set clipboard: {}", e))?;

    thread::sleep(Duration::from_millis(60));

    // Simular Ctrl+V
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to init enigo: {}", e))?;

    enigo.key(Key::Control, Direction::Press)
        .map_err(|e| format!("enigo error: {}", e))?;
    enigo.key(Key::Unicode('v'), Direction::Click)
        .map_err(|e| format!("enigo error: {}", e))?;
    enigo.key(Key::Control, Direction::Release)
        .map_err(|e| format!("enigo error: {}", e))?;

    thread::sleep(Duration::from_millis(80));

    // Restaurar clipboard original
    if let Some(prev) = previous {
        clipboard.set_text(prev).ok();
    }

    Ok(())
}
```

---

## Passo 4 — Command `trigger_translate` (`src/tauri/src/commands/overlay.rs`)

```rust
use tauri::{AppHandle, Manager};
use crate::state::AppState;
use crate::text_bridge::{capture_selection, inject_text};
use crate::ai_client;                           // era: use crate::groq [deprecated]
use crate::db::settings as db_settings;

#[tauri::command]
pub async fn trigger_translate(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    emit_overlay_state(&app, "loading");

    // 1. Capturar seleção
    let selected = match capture_selection() {
        Ok(Some(text)) => text,
        Ok(None) => {
            emit_overlay_state(&app, "idle");
            return Ok(());  // Sem seleção — silencioso
        }
        Err(e) => {
            emit_overlay_state(&app, "error");
            emit_overlay_error(&app, &e);
            return Err(e);
        }
    };

    // 2. Buscar API key
    let api_key = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db_settings::get_api_key(&conn).map_err(|e| e.to_string())?
    };
    let api_key = match api_key {
        Some(k) => k,
        None => {
            let msg = "API key not configured".to_string();
            emit_overlay_state(&app, "error");
            emit_overlay_error(&app, &msg);
            return Err(msg);
        }
    };

    // 3. Traduzir via Gemini (era: Groq [deprecated])
    let translated = match ai_client::fetch_translation(&state.http, &api_key, &selected).await {
        Ok(t) => t,
        Err(e) => {
            emit_overlay_state(&app, "error");
            emit_overlay_error(&app, &e);
            return Err(e);
        }
    };

    // 4. Injetar texto traduzido
    if let Err(e) = inject_text(&translated) {
        emit_overlay_state(&app, "error");
        emit_overlay_error(&app, &e);
        return Err(e);
    }

    // 5. Feedback de sucesso (2s → idle)
    emit_overlay_state(&app, "success");
    tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
    emit_overlay_state(&app, "idle");

    Ok(())
}

fn emit_overlay_state(app: &AppHandle, state: &str) {
    app.emit_to("overlay", "overlay:state", state).ok();
}

fn emit_overlay_error(app: &AppHandle, message: &str) {
    app.emit_to("overlay", "overlay:error", message).ok();
}
```

---

## Passo 5 — Registrar `Ctrl+Alt+T` (`src/tauri/src/shortcuts.rs`)

Adicionar ao `register_all` (chamado com `app_handle` disponível após setup):

```rust
pub fn register_translate_shortcut(app: &AppHandle) {
    let app_handle = app.clone();
    let shortcut = if cfg!(target_os = "macos") { "Command+Alt+T" } else { "Control+Alt+T" };

    app.global_shortcut().on_shortcut(shortcut, move |_, _, event| {
        if event.state() != ShortcutState::Pressed { return; }
        let app = app_handle.clone();
        // Disparar em nova task async para não bloquear o handler
        tauri::async_runtime::spawn(async move {
            let state = app.state::<AppState>();
            if let Err(e) = trigger_translate_internal(&app, &state).await {
                eprintln!("[shortcut] translation error: {}", e);
            }
        });
    }).ok();
}

// Mesma lógica do command, extraída como função para reutilizar do shortcut
async fn trigger_translate_internal(app: &AppHandle, state: &AppState) -> Result<(), String> {
    // Replicar lógica do command trigger_translate aqui
    // Ou invocar diretamente — ver nota abaixo
    Ok(())
}
```

**Nota:** Para evitar duplicação, o shortcut pode chamar o command via `app.invoke(...)` internamente, ou extrair a lógica de `trigger_translate` para uma função standalone em `overlay.rs` que tanto o command quanto o shortcut chamam.

---

## Passo 6 — Persistência de Posição do Overlay

O overlay salva sua posição quando movido. Implementar em `main.rs` no setup:

```rust
// Listener para posição do overlay emitida pelo renderer
let overlay_win = app.get_webview_window("overlay").unwrap();
let app_data = app.path().app_data_dir().unwrap();
let position_file = app_data.join("overlay-position.json");

// Carregar posição salva ao iniciar
if let Ok(content) = std::fs::read_to_string(&position_file) {
    if let Ok(pos) = serde_json::from_str::<serde_json::Value>(&content) {
        let x = pos["x"].as_i64().unwrap_or(32) as i32;
        let y = pos["y"].as_i64().unwrap_or(200) as i32;
        overlay_win.set_position(tauri::PhysicalPosition { x, y }).ok();
    }
}
```

O renderer do overlay emite `overlay:set-position` via `invoke('set_overlay_position', { x, y })`:

```rust
#[tauri::command]
pub fn set_overlay_position(
    x: i32,
    y: i32,
    window: tauri::WebviewWindow,
    app: AppHandle,
) -> Result<(), String> {
    window.set_position(tauri::PhysicalPosition { x, y })
        .map_err(|e| e.to_string())?;

    // Persistir posição
    let position_file = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("overlay-position.json");

    let content = serde_json::json!({ "x": x, "y": y }).to_string();
    std::fs::write(position_file, content).map_err(|e| e.to_string())?;

    Ok(())
}
```

---

## Passo 7 — Adaptar Renderer do Overlay

### `src/renderer/overlay-main.tsx` e componente `FloatingButton.tsx`

Substituir `window.lexioOverlay.*` por `invoke` e `listen`:

```ts
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { OverlayState } from '../../types'

// Registrar listener de estado
useEffect(() => {
  const unlisten = listen<OverlayState>('overlay:state', (e) => {
    setState(e.payload)
  })
  const unlistenError = listen<string>('overlay:error', (e) => {
    setError(e.payload)
  })
  return () => {
    unlisten.then(fn => fn())
    unlistenError.then(fn => fn())
  }
}, [])

// Disparar tradução
const handleTranslate = () => invoke('trigger_translate')

// Drag do overlay (sem foco, usa setPosition via invoke)
const handleDrag = (x: number, y: number) => {
  invoke('set_overlay_position', { x: Math.round(x), y: Math.round(y) })
}
```

Deletar `src/preload/overlay-preload.ts` — não é mais necessário.

---

## Passo 8 — Testes

### `text_bridge.rs` — testes são difíceis por dependerem do OS

Estratégia: criar uma trait `ClipboardIO` mockável, injetar em testes:

```rust
#[cfg(test)]
mod tests {
    // Testar apenas a lógica de delay e sequência sem clipboard real
    // Os testes de integração real são manuais (verificar comportamento no app)

    #[test]
    fn test_capture_returns_none_on_empty_clipboard() {
        // Em CI sem display, arboard pode falhar — usar conditional compilation
        // #[cfg(not(ci))]
        // let result = capture_selection();
        // assert!(result.is_ok());
    }
}
```

### Testes de integração manual (checklist):
- [ ] Selecionar texto em Notepad, pressionar Ctrl+Alt+T → tradução injetada
- [ ] Selecionar texto em browser, pressionar Ctrl+Alt+T → tradução injetada
- [ ] Sem seleção, pressionar Ctrl+Alt+T → overlay volta para idle silenciosamente
- [ ] Sem API key, pressionar Ctrl+Alt+T → overlay mostra error

---

## Critério de Saída da Fase 5

- [ ] `Ctrl+Alt+T` captura seleção de qualquer app Windows
- [ ] Tradução é injetada na janela focada anteriormente
- [ ] Clipboard do usuário é restaurado após injeção
- [ ] Overlay exibe estados: idle → loading → success → idle
- [ ] Overlay exibe estado error quando API key ausente ou Gemini falha
- [ ] Overlay pode ser arrastado e posição persiste entre reinicializações
- [ ] `Ctrl+Alt+O` mostra/esconde overlay
- [ ] `cargo test` passa (exceto testes de clipboard que requerem display)
- [ ] `src/preload/overlay-preload.ts` deletado
- [ ] `npm run build:renderer` passa sem erros
