# Fase 3 — Backend: Commands de Suggestion

**Objetivo:** Implementar os 3 commands Tauri que orquestram o fluxo de sugestão — `suggestion_request` (lê pending, chama Gemini, retorna tradução), `suggestion_accept` (injeta texto no app original), `suggestion_dismiss` (descarta). Ao final desta fase, os 3 commands são invocáveis via `__TAURI__.core.invoke(...)` no console do devtools.

**Referência:** `SPEC.md` — Seções 7 (Contrato IPC), 4 (AppState/PendingSuggestion), 10 (Preservação de clipboard)

---

## Skills e Modelo

**Modelo recomendado:** `claude-opus-4-6`
Esta fase envolve async Rust com MutexGuard, integração com `ai_client`, e a regra crítica de não segurar MutexGuard através de await. Requer raciocínio cuidadoso sobre lifetimes e concorrência. Usar Opus.

**Ler antes de implementar:**

| Skill | Por quê |
|---|---|
| `.claude/skills/tauri-architecture/SKILL.md` | **Regra crítica:** nunca segurar `MutexGuard` através de `await`. Padrão de commands async com AppState. |
| `.claude/skills/rust-patterns/SKILL.md` | Error handling com `Result<T, String>`, extração do lock em bloco separado |
| `.claude/skills/sqlite-patterns/SKILL.md` | Como buscar a API key no DB (já existe em `db/settings.rs`) |

---

## Pré-requisitos

- Fase 1 concluída (tipos `PendingSuggestion`, `SuggestionResponse`, `TextSelectedPayload` existem)
- Fase 2 concluída (tipos TS existem, componente criado)
- `ai_client::fetch_translation()` existente em `src/tauri/src/ai_client/mod.rs` (não modificar)
- `text_bridge::inject_text()` existente em `src/tauri/src/text_bridge.rs` (não modificar)

---

## Estrutura de Arquivos desta Fase

```
src/tauri/src/
├── commands/
│   ├── suggestion.rs   ← NOVO
│   └── mod.rs          ← MODIFICAR: exportar suggestion
└── main.rs             ← MODIFICAR: registrar novos commands no invoke_handler!
```

---

## Passo 1 — Criar `commands/suggestion.rs`

```rust
// src/tauri/src/commands/suggestion.rs

use tauri::{AppHandle, State};
use crate::state::AppState;
use crate::types::SuggestionResponse;
use crate::{ai_client, text_bridge};
use crate::db::settings as db_settings;

/// Chamado quando o usuário clica no bubble em estado "available".
///
/// Lê o texto pendente do AppState (capturado pelo selection_watcher),
/// busca a API key, chama Gemini para tradução e retorna o resultado.
/// NÃO modifica nada no app-origem — apenas retorna a tradução.
///
/// REGRA CRÍTICA: não segurar MutexGuard através de qualquer .await
#[tauri::command]
pub async fn suggestion_request(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SuggestionResponse, String> {
    // 1. Extrair o texto pendente — lock liberado antes do await
    let original_text = {
        let guard = state.pending_suggestion
            .lock()
            .map_err(|e| format!("Failed to lock pending_suggestion: {}", e))?;

        match guard.as_ref() {
            Some(pending) => pending.original_text.clone(),
            None => return Err("No pending suggestion — selection may have expired".to_string()),
        }
    }; // MutexGuard dropped aqui

    // 2. Buscar API key — lock liberado antes do await
    let api_key = {
        let conn = state.db
            .lock()
            .map_err(|e| format!("Failed to lock db: {}", e))?;

        db_settings::get_api_key(&conn)
            .map_err(|e| format!("DB error: {}", e))?
    }; // MutexGuard dropped aqui

    let api_key = match api_key {
        Some(k) if !k.is_empty() => k,
        _ => {
            app.emit_to("overlay", "overlay:suggestion-state", "error").ok();
            app.emit_to("overlay", "overlay:suggestion-error", "API key não configurada. Acesse Configurações.").ok();
            return Err("API key not configured".to_string());
        }
    };

    // 3. Emitir estado loading antes do await
    app.emit_to("overlay", "overlay:suggestion-state", "loading").ok();

    // 4. Chamar Gemini (async — nenhum Mutex é segurado aqui)
    let translation = match ai_client::fetch_translation(&state.http, &api_key, &original_text).await {
        Ok(t) => t,
        Err(e) => {
            app.emit_to("overlay", "overlay:suggestion-state", "error").ok();
            app.emit_to("overlay", "overlay:suggestion-error", &e).ok();
            return Err(e);
        }
    };

    // 5. Emitir estado ready
    app.emit_to("overlay", "overlay:suggestion-state", "ready").ok();

    Ok(SuggestionResponse {
        original: original_text,
        translation,
    })
}

/// Chamado quando o usuário clica "Aceitar" no dialog.
///
/// Injeta o texto traduzido no app ativo via Ctrl+V (enigo).
/// Limpa a sugestão pendente.
/// Emite overlay:suggestion-state=idle.
#[tauri::command]
pub async fn suggestion_accept(
    text: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Injetar texto (operação bloqueante — rodar em spawn_blocking)
    let text_clone = text.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        text_bridge::inject_text(&text_clone)
    }).await
    .map_err(|e| format!("spawn_blocking error: {}", e))?;

    if let Err(e) = result {
        app.emit_to("overlay", "overlay:suggestion-state", "error").ok();
        app.emit_to("overlay", "overlay:suggestion-error", &e).ok();
        return Err(e);
    }

    // Limpar sugestão pendente
    if let Ok(mut guard) = state.pending_suggestion.lock() {
        *guard = None;
    }

    // Emitir idle — overlay volta ao estado padrão
    app.emit_to("overlay", "overlay:suggestion-state", "idle").ok();

    Ok(())
}

/// Chamado quando o usuário clica "Rejeitar", pressiona ESC, ou clica fora.
///
/// Descarta a sugestão pendente sem modificar nada.
/// Emite overlay:suggestion-state=idle.
#[tauri::command]
pub fn suggestion_dismiss(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Limpar sugestão pendente
    if let Ok(mut guard) = state.pending_suggestion.lock() {
        *guard = None;
    }

    // Emitir idle
    app.emit_to("overlay", "overlay:suggestion-state", "idle").ok();

    Ok(())
}
```

---

## Passo 2 — Exportar em `commands/mod.rs`

Adicionar ao arquivo existente:

```rust
// src/tauri/src/commands/mod.rs
pub mod suggestion;
// ... demais módulos existentes ...
```

---

## Passo 3 — Registrar em `main.rs`

No `invoke_handler!`, adicionar os 3 novos commands:

```rust
// src/tauri/src/main.rs

.invoke_handler(tauri::generate_handler![
    // ... commands existentes ...
    commands::suggestion::suggestion_request,
    commands::suggestion::suggestion_accept,
    commands::suggestion::suggestion_dismiss,
])
```

---

## Passo 4 — Verificação via Tauri Devtools

Com o app rodando em `npm run dev`, abrir o devtools da janela overlay (`Ctrl+Shift+I` ou via código) e testar:

```javascript
// Verificar se suggestion_request está registrado
// (deve retornar erro "No pending suggestion" — isso é correto)
await __TAURI__.core.invoke('suggestion_request')
// Esperado: erro "No pending suggestion — selection may have expired"

// Verificar suggestion_dismiss (deve funcionar silenciosamente)
await __TAURI__.core.invoke('suggestion_dismiss')
// Esperado: undefined (sem erro)

// Verificar suggestion_accept com texto de teste
await __TAURI__.core.invoke('suggestion_accept', { text: 'Hello world' })
// Esperado: injeta "Hello world" onde o cursor estava
```

---

## Verificação da Fase 3

```bash
cargo build  # zero warnings
cargo test   # testes existentes ainda passando
```

### Checklist de saída

- [ ] `commands/suggestion.rs` criado com os 3 commands
- [ ] Nenhum `MutexGuard` é segurado através de um `await` (verificar manualmente)
- [ ] `commands/mod.rs` exporta `suggestion`
- [ ] `main.rs` registra os 3 commands no `invoke_handler!`
- [ ] `cargo build` limpo, zero warnings
- [ ] `cargo test` passando
- [ ] **Teste manual via devtools:** `suggestion_dismiss` retorna sem erro
- [ ] **Teste manual via devtools:** `suggestion_request` retorna erro "No pending suggestion" (correto — ainda não há seleção)
- [ ] **Teste manual via devtools:** `suggestion_accept({text: "Hello"})` injeta texto na janela focada

---

## Arquivos Criados nesta Fase

- `src/tauri/src/commands/suggestion.rs`

## Arquivos Modificados nesta Fase

- `src/tauri/src/commands/mod.rs`
- `src/tauri/src/main.rs`
