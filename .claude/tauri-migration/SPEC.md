# Lexio — Especificação de Migração Electron → Tauri v2

**Objetivo:** Migrar o Lexio de Electron para Tauri v2 mantendo todas as funcionalidades existentes, sem adicionar nada novo. O resultado final deve ser funcionalmente idêntico ao app atual.

---

## 1. O que muda e o que não muda

### Muda
| Camada | Electron (atual) | Tauri (alvo) |
|---|---|---|
| Shell nativo | Chromium + Node.js | WebView2/WKWebView + Rust |
| Chamadas AI (palavras) | `ai.ts` no renderer (fetch do browser) — GROQ [deprecated] | Rust command `get_word` (reqwest → Gemini) |
| Chamadas AI (tradução) | `translate.ts` no main (Node fetch) — GROQ [deprecated] | Rust function `translate_text` (reqwest → Gemini) |
| Banco SQLite | `better-sqlite3` (Node, síncrono) | `rusqlite` (Rust, síncrono via Mutex) |
| Captura de seleção | `selection-hook` (UIAutomation passiva) | `arboard` + simulação Ctrl+C via `enigo` |
| Injeção de texto | `nut.js` (SendInput) | `enigo` (virtual keys) |
| Atalhos globais | `globalShortcut` do Electron | `tauri-plugin-global-shortcut` |
| Auto-updater | `electron-updater` | `tauri-plugin-updater` |
| System tray | `Tray` do Electron | `tauri-plugin-shell` + `SystemTray` da API Tauri |
| Bridge renderer | `contextBridge` + preload.ts | `@tauri-apps/api/core` `invoke()` — sem preload |

### Não muda
- Todo o código React/TSX dos componentes
- Toda a lógica dos hooks (exceto as assinaturas de IPC)
- O schema SQLite (mesmas tabelas, mesmos campos)
- As funcionalidades: busca de palavras, histórico, salvos, overlay de tradução, atalhos, atualização automática, bandeja do sistema
- O suporte a locales (`pt-BR`, `es`) — já é funcionalidade real, permanece igual

---

## 2. Janelas — Manifesto Tauri

Duas janelas declaradas em `tauri.conf.json` (replicando o comportamento atual):

### `main` — Buscador
- Dimensões iniciais: `600 × 60` (idle) → `600 × 420` (result)
- Sem borda (`decorations: false`), sem taskbar (`skip_taskbar: true`), transparente
- Atalho: `Ctrl+Alt+E` (toggle visibilidade + reposiciona no centro do monitor com cursor)
- Resize controlado pelo Rust via `app_handle.get_webview_window("main").set_size(...)`

### `overlay` — Bolha Flutuante
- Dimensões fixas: `48 × 48`
- Always-on-top, transparente, sem foco (`focus: false`), sem borda
- Atalhos: `Ctrl+Alt+T` (disparar tradução) e `Ctrl+Alt+O` (toggle visibilidade)
- Posição `x/y` persistida em `overlay-position.json` no `app_data_dir` (já é assim hoje)

---

## 3. Contrato IPC Completo (Rust Commands)

Mapeamento 1:1 com a `LexioAPI` atual. Todos os commands que fazem I/O devem ser `async fn`.

### Palavras

```rust
// Busca no SQLite. Se não encontrar, chama Gemini, salva no DB, retorna pronta.
// MUDANÇA DE DESIGN: renderer não chama mais AI diretamente (ai.ts é deletado).
#[tauri::command]
async fn get_word(
    word: String,
    locale: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<Word>, String>

// Upsert explícito (mantido para compatibilidade com fluxos que precisam de save manual)
#[tauri::command]
fn save_word(
    data: AIWordResponse,
    locale: String,
    state: tauri::State<'_, AppState>,
) -> Result<Word, String>

// Estes são síncronos — apenas SQLite, sem I/O externo
#[tauri::command]
fn toggle_saved(word: String, state: tauri::State<'_, AppState>) -> Result<Word, String>

#[tauri::command]
fn delete_word(word: String, state: tauri::State<'_, AppState>) -> Result<(), String>

#[tauri::command]
fn remove_from_history(word: String, state: tauri::State<'_, AppState>) -> Result<(), String>

#[tauri::command]
fn unsave_word(word: String, state: tauri::State<'_, AppState>) -> Result<(), String>

#[tauri::command]
fn get_history(locale: String, limit: u32, state: tauri::State<'_, AppState>) -> Result<Vec<Word>, String>

#[tauri::command]
fn get_saved(locale: String, state: tauri::State<'_, AppState>) -> Result<Vec<Word>, String>
```

### Janela e App

```rust
#[tauri::command]
fn close_window(window: tauri::Window)  // window.hide()

#[tauri::command]
fn minimize_window(window: tauri::Window)  // window.minimize()

#[tauri::command]
fn resize_window(state: String, window: tauri::Window)
// state == "idle"   → set_size(600, 60)
// state == "result" → set_size(600, 420)

#[tauri::command]
fn get_app_version(app: tauri::AppHandle) -> String  // app.package_info().version
```

### Settings

```rust
#[tauri::command]
fn get_api_key(state: tauri::State<'_, AppState>) -> Result<Option<String>, String>

#[tauri::command]
fn set_api_key(key: String, state: tauri::State<'_, AppState>) -> Result<(), String>
```

### Overlay (eventos unidirecionais — Rust → Frontend)

Não são `invoke`, são eventos emitidos via `app_handle.emit_to("overlay", ...)`:
- `overlay:state` → payload: `"idle" | "loading" | "success" | "error"`
- `overlay:error` → payload: `String`

O frontend do overlay chama `invoke('trigger_translate')` para disparar o fluxo.

```rust
#[tauri::command]
async fn trigger_translate(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String>
```

---

## 4. State Management (Rust)

Um único `AppState` compartilhado entre todos os commands via `tauri::State`:

```rust
pub struct AppState {
    pub db: Mutex<Connection>,        // rusqlite connection
    pub http: reqwest::Client,        // reqwest async client (reutilizável)
}
```

O `AppState` é criado no `main.rs` e registrado com `.manage(state)`.

---

## 5. Banco de Dados (rusqlite)

### Schema
Idêntico ao atual — mesmas tabelas `words`, `word_translations`, `settings`.

### Serialização
Arrays (`meanings`, `synonyms`, `antonyms`, `contexts`, `verb_forms`) são armazenados como JSON strings. Usar `serde_json::to_string` / `serde_json::from_str` — equivalente exato do `JSON.stringify`/`JSON.parse` atual.

### Migrations
As migrations inline que existem hoje em `db.ts` (ADD COLUMN se não existir) devem ser replicadas em Rust usando `pragma table_info` equivalente. Não usar bibliotecas de migration — manter o padrão simples atual.

### Path do DB
`app_handle.path().app_data_dir()? / "lexio.db"` — equivalente ao `app.getPath('userData')` do Electron.

---

## 6. Integração AI — Gemini (reqwest em Rust)

> **GROQ [deprecated]** — usado apenas no app Electron atual. A migração Tauri usa Gemini 2.0 Flash.
> O módulo Rust se chama `ai_client/` (agnóstico de provider) para facilitar troca futura na monetização.

### Provider ativo: Gemini 2.0 Flash
- **Endpoint (OpenAI-compatible):** `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
- **Modelo MVP:** `gemini-2.0-flash` (free tier: 15 RPM, 1500 RPD)
- **Modelo paid (monetização):** `gemini-2.0-flash` (pago) ou `gemini-1.5-pro`
- **Auth:** `Authorization: Bearer {api_key}` (igual ao GROQ — mudança mínima)
- **Free tier suficiente para:** uso pessoal intensivo + primeiros beta users

### Busca de palavra (`get_word`)
Hoje: renderer chama `ai.ts` com GROQ → salva via IPC.
Novo: command Rust faz tudo via Gemini:

```
get_word("churn", "pt-BR")
  ↓ SELECT no SQLite
  → encontrou: retorna Word diretamente
  → não encontrou:
      ↓ POST https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
      ↓ model: "gemini-2.0-flash"
      ↓ parsear JSON → AIWordResponse
      ↓ upsert no SQLite
      → retorna Word
```

O system prompt e user prompt (hoje em `ai.ts` chamando GROQ) devem ser portados para strings Rust constantes — os prompts não mudam, apenas o endpoint/modelo. A lógica de `buildUserPrompt` com locale-specific instructions é mantida integralmente.

**Impacto no frontend:** `src/renderer/lib/ai.ts` é **deletado**. O hook `useSearch.ts` para de chamar `fetchWordFromGroq` + `saveWord` e passa a fazer apenas `invoke('get_word', { word, locale })`.

### Tradução de texto (`trigger_translate`)
Já é do main process hoje (`translate.ts` — chamava GROQ [deprecated]). Em Rust é direto via Gemini:
1. Emite `overlay:state loading`
2. Captura seleção (ver Seção 7)
3. POST para Gemini com prompt de tradução
4. Injeta texto (ver Seção 7)
5. Emite `overlay:state success` → aguarda 2s → emite `overlay:state idle`

### Preparando para Monetização (troca de provider)
O módulo `ai_client/` expõe uma constante `AI_MODEL` e `AI_BASE_URL` que podem ser:
- Lidas de `settings` no SQLite (para permitir que o usuário configure)
- Ou compiladas como `#[cfg(feature = "paid")]` para builds diferentes

```rust
// ai_client/config.rs
pub const AI_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta/openai";
pub const AI_MODEL_FREE: &str = "gemini-2.0-flash";
pub const AI_MODEL_PAID: &str = "gemini-2.0-flash";  // mesmo modelo, só muda o tier da key
```

---

## 7. Captura de Seleção e Injeção de Texto

### Situação atual
- `selection-hook`: UIAutomation **passiva** — não precisa pressionar nada, lê a seleção ativa do OS
- `nut.js`: injeção via clipboard (escreve no clipboard, simula Ctrl+V, restaura clipboard)

### Solução Tauri (tradeoff explícito)

**Captura:** `enigo` simula `Ctrl+C` → `arboard` lê o clipboard.

**Diferença de comportamento:** A solução atual é passiva (nenhum keypress). A nova simula um Ctrl+C, que pode ter efeitos colaterais em apps que interceptam esse atalho (terminais, editores, jogos). Na prática, o fluxo atual já restaura o clipboard depois da injeção, então o estado final é o mesmo. O efeito colateral é que Ctrl+C é emitido antes de ler.

**Se isso for inaceitável no futuro:** existe a opção de implementar UIAutomation via Win32 em Rust com a crate `windows-rs`, que replicaria o comportamento passivo do `selection-hook`. Isso fica fora do escopo desta migração.

**Injeção:** `enigo` para Ctrl+V — idêntico ao que `nut.js` faz hoje.

Crates:
- `enigo = "0.2"` — keyboard + mouse simulation
- `arboard = "3"` — clipboard cross-platform

Fluxo completo:
```rust
// 1. Salvar clipboard atual
let previous = clipboard.get_text().unwrap_or_default();
// 2. Simular Ctrl+C
enigo.key(Key::Control, Direction::Press);
enigo.key(Key::C, Direction::Click);
enigo.key(Key::Control, Direction::Release);
// 3. Aguardar (~60ms para o OS processar)
// 4. Ler clipboard (texto selecionado)
let selected = clipboard.get_text()?;
// 5. Chamar Gemini
let translated = ai_client::fetch_translation(selected).await?;
// 6. Escrever tradução no clipboard
clipboard.set_text(translated);
// 7. Simular Ctrl+V
// 8. Aguardar (~80ms)
// 9. Restaurar clipboard anterior
clipboard.set_text(previous);
```

---

## 8. Atalhos Globais

| Atalho | Ação | Plugin |
|---|---|---|
| `Ctrl+Alt+E` | Toggle janela main (show/hide + reposicionar no centro) | `tauri-plugin-global-shortcut` |
| `Ctrl+Alt+O` | Toggle overlay (show/hide) | `tauri-plugin-global-shortcut` |
| `Ctrl+Alt+T` | Disparar fluxo de tradução | `tauri-plugin-global-shortcut` |

Mac usa `Command+Alt` — manter equivalência via detecção de OS no plugin.

---

## 9. System Tray

Plugin: `tauri-plugin-shell` não — usar a API de tray nativa do Tauri v2 (`SystemTray`, `SystemTrayMenu`).

Menu atual (replicar):
- "Show Lexio" → `window.show()`
- "Show Overlay" / "Hide Overlay" → toggle overlay
- Separador
- "Quit" → `app.exit(0)`

---

## 10. Auto-updater

Plugin: `tauri-plugin-updater`

Eventos mapeados do `electron-updater`:

| electron-updater | Tauri plugin-updater |
|---|---|
| `update-available` | `.check()` retorna `Some(Update)` |
| `download-progress` | `.download_with_progress(cb)` |
| `update-downloaded` | download completo |
| `quitAndInstall()` | `.install()` |

Os eventos para o renderer (`update:available`, `update:progress`, `update:downloaded`) são emitidos via `app_handle.emit_to("main", ...)` — mesmo padrão dos eventos de overlay.

---

## 11. Adaptação do Frontend React

### Substituição de `window.lexio.*` por `invoke()`

Todos os hooks em `src/renderer/hooks/` trocam:
```ts
// antes
window.lexio.getWord(word, locale)

// depois
invoke<Word | null>('get_word', { word, locale })
```

As assinaturas permanecem idênticas para os componentes — a mudança fica contida nos hooks.

### Tipos IPC
O arquivo `src/types/index.ts` permanece como está. `LexioAPI` e `OverlayAPI` podem coexistir como interfaces TypeScript mesmo sem `contextBridge` — servem de documentação do contrato.

### `ai.ts`
**Deletado.** A lógica de prompt (system prompt + buildUserPrompt) é portada para Rust.

### Eventos de backend → renderer
Substituir `ipcRenderer.on(...)` por `listen()` do `@tauri-apps/api/event`:
```ts
// antes
ipcRenderer.on('update:available', (_, v) => cb(v))

// depois
await listen<string>('update:available', (e) => cb(e.payload))
```

---

## 12. Estratégia de Testes

### Rust (unit tests)
- Commands do DB testados com banco em memória (`Connection::open_in_memory()`)
- `get_word` com Gemini mockado via trait `AiClient` injetável
- Testar serialização/deserialização de todos os campos JSON

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_upsert_and_get_word() { ... }

    #[test]
    fn test_deserialize_meanings() { ... }
}
```

### Frontend (Vitest — já existente)
- Mocks de `invoke()` via `@tauri-apps/api/mocks` (`mockIPC`)
- Hooks testados com respostas mockadas dos commands Rust
- `ai.test.ts` atual deve ser reescrito para testar a nova lógica (sem fetch direto)

### E2E (Playwright + WebDriver)
- Tauri suporta WebDriverIO via `tauri-driver` (não Playwright nativo)
- Para E2E, usar `@tauri-apps/api/mocks` no modo de teste + `TAURI_WEBDRIVER=1`
- Manter a estrutura de testes atual — adaptar apenas o driver

---

## 13. Fases de Execução

### Fase 1 — Scaffolding Tauri
**O que é:** Criar um projeto Tauri v2 do zero. Copiar o renderer React existente para dentro. Não é "enxertar" — é criar uma shell nova que carrega o mesmo frontend.

Etapas:
1. `npm create tauri-app@latest` com template existente (React + TypeScript + Vite)
2. Copiar `src/renderer/`, `src/types/`, `package.json` (deps do renderer)
3. Validar que o renderer compila e aparece na WebView sem erros
4. Configurar as duas janelas em `tauri.conf.json`

**Critério de saída:** App abre com as duas janelas, frontend renderiza, sem funcionalidade nativa ainda.

### Fase 2 — Backend Rust: DB + Settings
Implementar `AppState`, `rusqlite`, schema completo, todas as funções de DB, commands síncronos de palavra e settings. Testar com unit tests em memória.

**Critério de saída:** `invoke('get_history', ...)` retorna dados reais do SQLite. `invoke('set_api_key', ...)` persiste.

### Fase 3 — Backend Rust: AI Client (Gemini)
Implementar `reqwest` client, portar system prompt e buildUserPrompt para Rust, implementar `get_word` com fallback Gemini + auto-save. Deletar `ai.ts` do renderer (chamava GROQ [deprecated]). Atualizar `useSearch.ts`.

**Critério de saída:** Busca de palavra funciona end-to-end. Palavra não-cacheada vai ao Gemini e é salva.

### Fase 4 — Janelas, Atalhos e Tray
Implementar resize da janela main, atalhos globais (Ctrl+Alt+E/O/T), system tray.

**Critério de saída:** Todos os atalhos funcionam. App minimiza para tray.

### Fase 5 — Overlay e Tradução
Implementar `trigger_translate` com `enigo` + `arboard`. Emissão de eventos de estado para o overlay. Persistência de posição.

**Critério de saída:** Ctrl+Alt+T captura seleção, traduz, injeta. Overlay mostra estados loading/success/error.

### Fase 6 — Auto-updater e Testes Finais
Integrar `tauri-plugin-updater`, mapear eventos para o renderer. Adaptar testes Vitest para `mockIPC`. Executar build de produção completa.

**Critério de saída:** Build passa. Testes passam. Funcionalidades idênticas ao app Electron atual.

---

## 14. Dependências Rust (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon", "image-ico", "image-png"] }
tauri-plugin-global-shortcut = "2"
tauri-plugin-updater = "2"
rusqlite = { version = "0.31", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
tokio = { version = "1", features = ["full"] }
arboard = "3"
enigo = "0.2"
```

## 15. Checklist de Paridade Funcional

Antes de considerar a migração completa, todas as linhas devem estar marcadas:

- [ ] Busca de palavra (cache hit)
- [ ] Busca de palavra (cache miss → Gemini → salvar)
- [ ] Histórico de palavras por locale
- [ ] Palavras salvas por locale
- [ ] Toggle salvar palavra
- [ ] Remover do histórico
- [ ] Deletar palavra
- [ ] Locale switch (pt-BR / es)
- [ ] Settings: salvar e ler API key
- [ ] Ctrl+Alt+E toggle main window + reposicionamento
- [ ] Ctrl+Alt+O toggle overlay
- [ ] Ctrl+Alt+T tradução (captura → Gemini → injeção)
- [ ] Overlay: estados idle/loading/success/error
- [ ] Overlay: drag e persistência de posição
- [ ] Resize de janela (idle ↔ result)
- [ ] System tray (show/hide/quit)
- [ ] Auto-updater: detecção, progresso, instalação
- [ ] Build de produção Windows sem erros
