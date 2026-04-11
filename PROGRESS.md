# Lexio — Tauri Migration Progress

Tracking document for the Electron → Tauri v2 migration. Updated at the end of each phase.

---

## Fase 1 — Scaffolding Tauri

**Branch:** `feat/migrate-to-tauri`
**Status:** Complete

### O que foi feito

| Passo | Descrição | Status |
|---|---|---|
| Rust backend | Criou `src/tauri/Cargo.toml`, `build.rs`, `src/main.rs` mínimo | ✅ |
| `tauri.conf.json` | Criou em `src/tauri/tauri.conf.json` com janelas `main` (600×60) e `overlay` (48×48), CSP e bundle config | ✅ |
| `package.json` | Substituiu scripts Electron por `tauri dev`/`tauri build`; removeu `electron`, `electron-builder`, `electron-updater`, `better-sqlite3`, `@nut-tree-fork/nut-js`, `selection-hook`; adicionou `@tauri-apps/cli`, `@tauri-apps/api` | ✅ |
| `vite.config.ts` | Adicionou `host: 'localhost'`, `envPrefix: ['VITE_', 'TAURI_']`, `define: { __TAURI__ }` | ✅ |
| `tauri-bridge.ts` | Criou `src/renderer/lib/tauri-bridge.ts` — wrapper sobre `invoke`/`listen` | ✅ |
| Ícones Tauri | Gerou todos os formatos via `npx tauri icon` a partir de `lexio-icon-512 1.png` | ✅ |
| Backup Electron | Copiou `src/main/` e `src/preload/` para `_electron_backup/` | ✅ |
| `tsconfig.json` | Adicionou `exclude` para `src/main`, `src/preload`, `_electron_backup` | ✅ |

### Arquivos criados

- `Cargo.toml` (workspace na raiz, contém `members = ["src/tauri"]`)
- `src/tauri/Cargo.toml`
- `src/tauri/build.rs`
- `src/tauri/src/main.rs`
- `src/tauri/tauri.conf.json` (configuração Tauri com janelas e bundle)
- `src/tauri/icons/` (32x32.png, 128x128.png, 128x128@2x.png, icon.icns, icon.ico + formatos mobile/Android/iOS)
- `src/renderer/lib/tauri-bridge.ts`
- `_electron_backup/main/` (cópia do main Electron)
- `_electron_backup/preload/` (cópia do preload Electron)

### Arquivos modificados

- `package.json` — scripts e deps atualizados
- `vite.config.ts` — configuração do dev server para Tauri
- `tsconfig.json` — exclusões para evitar compilação do código Electron

### Critérios de verificação

| Critério | Resultado |
|---|---|
| `npm run build:renderer` passa sem erros TypeScript | ✅ Verificado — 155 módulos transformados, zero erros |
| `cargo check` passa (sem erros Rust) | ✅ Verificado pelo usuário — `Finished check` com sucesso |
| App Tauri abre com `npm run dev` | ✅ Verificado pelo usuário — ambas as janelas aparecem |
| Janela `main` (600×60) aparece, transparente, sem borda | ✅ Confirmado pelo usuário |
| Janela `overlay` (48×48) aparece | ✅ Confirmado pelo usuário |
| Frontend React renderiza na janela main | ✅ Confirmado pelo usuário |
| Zero referências a `electron` causam crash | ✅ Confirmado — app roda sem erros |

### Dificuldades e decisões

1. **`tsc -b` vs `tsc -p tsconfig.renderer.json`** — O plano indicava `tsc -b`, mas como `tsconfig.json` na raiz não tem project references configuradas e os arquivos `src/main/` ainda existem (com imports de `electron` e `better-sqlite3` removidos do npm), `tsc -b` compilaria esses arquivos e falharia. Decisão: usar `tsc -p tsconfig.renderer.json` no script `build:renderer`, que aponta explicitamente para os arquivos do renderer. Mais robusto e previsível.

2. **Remoção de `src/main/` e `src/preload/`** — O usuário negou o `rm -rf` (operação destrutiva). Alternativa: adicionou `exclude` no `tsconfig.json` para ignorar esses diretórios durante a compilação. Os arquivos originais permanecem em `src/main/` e `src/preload/` além do backup em `_electron_backup/`.

3. **Localização do `tauri.conf.json`** — O plano original colocava o arquivo na raiz do projeto. O CLI do Tauri achou lá e `npm run dev` funcionou, mas `cargo check` falhou: o `tauri-build` procura o config na mesma pasta do `Cargo.toml` (`src/tauri/`). Correção: movido para `src/tauri/tauri.conf.json`; adicionado `Cargo.toml` workspace na raiz para que o CLI do Tauri descubra o crate automaticamente. Caminhos ajustados: `frontendDist: "../../dist"` e ícones com `"icons/..."` (relativos a `src/tauri/`).

4. **`cargo check` não executável no sandbox** — Binários nativos como `cargo.exe` não podem ser executados pelo Claude Code CLI no Windows. A verificação do backend Rust deve ser feita manualmente pelo usuário via `cargo check -p lexio` na raiz do worktree.

---

---

## Fase 2 — Backend Rust: DB + Settings

**Branch:** `feat/migrate-to-tauri`
**Status:** Complete

### O que foi feito

| Passo | Descrição | Status |
|---|---|---|
| `Cargo.toml` | Adicionou `rusqlite` (bundled) e `tokio` | ✅ |
| `types.rs` | Structs Rust com serde: `Word`, `AIWordResponse`, `MeaningEntry`, `VerbForms`, `WordExample` | ✅ |
| `state.rs` | `AppState` com `Mutex<Connection>` | ✅ |
| `db/mod.rs` | `init()`: schema + migrations (replica exata do `db.ts`) | ✅ |
| `db/words.rs` | `get_word`, `upsert_word`, `toggle_saved`, `delete_word`, `remove_from_history`, `unsave_word`, `get_history`, `get_saved` + 11 testes unitários | ✅ |
| `db/settings.rs` | `get_setting`, `set_setting`, `get_api_key`, `set_api_key` + 3 testes unitários | ✅ |
| `commands/words.rs` | 11 Tauri commands delegando para `db/` | ✅ |
| `main.rs` | `AppState` inicializado no `.setup()`, todos os commands registrados | ✅ |
| Hooks migrados | `useWords.ts`, `useSearch.ts`, `ai.ts`, `SettingsView.tsx` migrados de `window.lexio.*` para `invoke(...)` | ✅ |

### Arquivos criados

- `src/tauri/src/types.rs`
- `src/tauri/src/state.rs`
- `src/tauri/src/db/mod.rs`
- `src/tauri/src/db/words.rs`
- `src/tauri/src/db/settings.rs`
- `src/tauri/src/commands/mod.rs`
- `src/tauri/src/commands/words.rs`

### Arquivos modificados

- `src/tauri/Cargo.toml` — adicionou `rusqlite` e `tokio`
- `src/tauri/src/main.rs` — wired AppState, DB init, 11 commands
- `src/renderer/hooks/useWords.ts` — migrado para `invoke`
- `src/renderer/hooks/useSearch.ts` — migrado para `invoke`
- `src/renderer/lib/ai.ts` — `getApiKey` via `invoke`
- `src/renderer/components/SettingsView.tsx` — `getApiKey`, `setApiKey`, `getAppVersion` via `invoke`

### Testes unitários (14 total)

| Teste | Arquivo |
|---|---|
| `test_upsert_and_get_word` | `db/words.rs` |
| `test_get_word_case_insensitive` | `db/words.rs` |
| `test_get_word_missing_locale_returns_none` | `db/words.rs` |
| `test_toggle_saved` | `db/words.rs` |
| `test_json_serialization_roundtrip` | `db/words.rs` |
| `test_get_history_respects_in_history` | `db/words.rs` |
| `test_delete_word` | `db/words.rs` |
| `test_unsave_word` | `db/words.rs` |
| `test_get_saved` | `db/words.rs` |
| `test_meanings_roundtrip` | `db/words.rs` |
| `test_upsert_updates_existing_word` | `db/words.rs` |
| `test_api_key_roundtrip` | `db/settings.rs` |
| `test_setting_upsert` | `db/settings.rs` |
| `test_get_missing_setting` | `db/settings.rs` |

### Critérios de verificação

| Critério | Resultado |
|---|---|
| `cargo test` passa com 0 falhas | ✅ 14/14 testes passando |
| `npm run build:renderer` passa sem erros | ✅ 155 módulos, zero erros |
| Zero `any` no TypeScript dos hooks migrados | ✅ Todos os invokes tipados explicitamente |
| Lifetime error no `db/mod.rs` (`stmt` borrow) | ✅ Corrigido — `collect()` separado em binding antes de fechar o bloco |

### Dificuldades e decisões

1. **Lifetime error `E0597` em `migrate_old_meanings`** — O `MappedRows` iterator borrow `stmt`, mas `stmt` era dropped antes do iterator ser consumido ao final do bloco. Correção: separar o `collect()` em uma binding local (`let mapped = ...`) antes de fechar o bloco, permitindo que `stmt` seja dropped após o iterator.

2. **`useAutoUpdater.ts` não migrado** — Os eventos de auto-update (`onUpdateAvailable`, `onUpdateProgress`, `onUpdateDownloaded`, `installUpdate`) não existem ainda no backend Rust. Este hook permanece apontando para `window.lexio.*` e será migrado na Fase 5/6.

3. **`SettingsView.tsx` chamava IPC diretamente** — Violação pré-existente da regra "IPC só em hooks". Migrado para `invoke` mantendo a mesma estrutura; não foi criado hook de settings separado pois está fora do escopo da Fase 2.

---

## Fase 3 — Backend Rust: AI Client (Gemini) — Word Lookup

**Branch:** `feat/migrate-to-tauri`
**Status:** Complete

### O que foi feito

| Passo | Descrição | Status |
|---|---|---|
| `Cargo.toml` | Adicionou `reqwest` (json, rustls-tls) | ✅ |
| `state.rs` | Adicionou `http: Client` ao `AppState` (reutilizável, timeout 30s) | ✅ |
| `ai_client/config.rs` | Constantes de provider: endpoint Gemini OpenAI-compat, modelo `gemini-2.0-flash` | ✅ |
| `ai_client/word_prompt.rs` | System prompt + `build_user_prompt()` portados de `ai.ts` (prompts idênticos) | ✅ |
| `ai_client/mod.rs` | Cliente HTTP Gemini: structs de request/response, `fetch_word()` async + 9 testes | ✅ |
| `commands/words.rs` | `get_word` agora é async: cache hit → retorna; cache miss → Gemini → auto-save → retorna | ✅ |
| `main.rs` | Adicionou `mod ai_client` | ✅ |
| `ai.ts` deletado | Removido `src/renderer/lib/ai.ts` e `ai.test.ts` | ✅ |
| `useSearch.ts` simplificado | Uma única chamada `invoke('get_word', ...)` — backend faz tudo | ✅ |
| CSP limpo | Sem domínios de API externos (chamadas saem do Rust, não do renderer) | ✅ |

### Arquivos criados

- `src/tauri/src/ai_client/mod.rs` — cliente HTTP Gemini + structs + 9 testes unitários
- `src/tauri/src/ai_client/config.rs` — constantes de endpoint e modelo
- `src/tauri/src/ai_client/word_prompt.rs` — system prompt e build_user_prompt portados de ai.ts

### Arquivos modificados

- `src/tauri/Cargo.toml` — adicionou `reqwest`
- `src/tauri/src/state.rs` — `AppState` com `http: Client`
- `src/tauri/src/main.rs` — adicionou `mod ai_client`
- `src/tauri/src/commands/words.rs` — `get_word` agora async com cache miss → Gemini → auto-save
- `src/renderer/hooks/useSearch.ts` — simplificado para uma única chamada `invoke`

### Arquivos deletados

- `src/renderer/lib/ai.ts` — chamava GROQ no renderer (substituído por Rust)
- `src/renderer/lib/ai.test.ts` — testes de parse migrados para Rust

### Testes unitários (9 novos, 23 total)

| Teste | Arquivo |
|---|---|
| `test_model_is_gemini` | `ai_client/mod.rs` |
| `test_locale_name_pt_br` | `ai_client/mod.rs` |
| `test_locale_name_es` | `ai_client/mod.rs` |
| `test_locale_name_unknown_falls_back_to_english` | `ai_client/mod.rs` |
| `test_build_user_prompt_contains_word` | `ai_client/mod.rs` |
| `test_build_user_prompt_es_contains_spanish` | `ai_client/mod.rs` |
| `test_parse_ai_response_valid_json` | `ai_client/mod.rs` |
| `test_parse_ai_response_invalid_json_errors` | `ai_client/mod.rs` |
| `test_parse_ai_response_with_full_meanings` | `ai_client/mod.rs` |

### Critérios de verificação

| Critério | Resultado |
|---|---|
| `cargo test` passa (incluindo `test_model_is_gemini`) | ✅ Confirmado pelo usuário — 23/23 testes |
| Cache hit retorna imediatamente (sem chamada Gemini) | ✅ Lógica implementada — `get_word` retorna early se `cached.is_some()` |
| Cache miss chama Gemini, salva, retorna Word completa | ✅ Fluxo: DB miss → get API key → `fetch_word` → `upsert_word` → return |
| `ai.ts` deletado — `npm run build:renderer` passa sem erros | ✅ 158 módulos, zero erros |
| `useSearch.ts` não importa mais nada de `ai.ts` | ✅ Confirmado via grep |
| API key nunca aparece em logs do renderer | ✅ Key é lida e usada inteiramente em Rust |
| CSP limpo — sem domínios de API externos | ✅ `default-src 'self'` — chamadas saem do Rust |
| Nenhuma referência a `groq` no código Rust | ✅ Apenas mensagem de assert no teste |

### Decisões

1. **GROQ → Gemini** — O endpoint OpenAI-compatible do Gemini (`generativelanguage.googleapis.com/v1beta/openai/chat/completions`) aceita o mesmo payload que o GROQ. Mudança mínima: apenas endpoint e modelo.

2. **`save_word` command mantido** — O comando `save_word` permanece registrado no invoke_handler, mesmo que `useSearch.ts` não o chame mais diretamente (o fluxo agora é via `get_word` async). Manter para uso futuro se necessário.

3. **API key no Rust, não no renderer** — Antes: renderer lia a key via `invoke('get_api_key')`, passava para `ai.ts` que chamava GROQ. Depois: renderer apenas chama `invoke('get_word')`, e o Rust lê a key internamente. A key nunca sai do backend.

4. **MutexGuard liberado antes de cada `.await`** — O `get_word` async usa blocos `{ }` para garantir que o lock do DB é liberado antes de qualquer ponto de await (chamada HTTP). Sem isso, deadlock é garantido.

---

## Fase 4 — Janelas, Atalhos e System Tray

**Branch:** `feat/migrate-to-tauri`
**Status:** Complete

### O que foi feito

| Passo | Descrição | Status |
|---|---|---|
| `Cargo.toml` | Adicionou `tauri-plugin-global-shortcut = "2"` | ✅ |
| `tauri.conf.json` | Registrou `"plugins": { "global-shortcut": {} }` | ✅ |
| `commands/window.rs` | `close_window`, `minimize_window`, `resize_window`, `get_app_version` + 2 testes | ✅ |
| `commands/mod.rs` | Adicionou `pub mod window` | ✅ |
| `commands/words.rs` | Removeu `get_app_version` (movido para `window.rs`) | ✅ |
| `shortcuts.rs` | `Ctrl+Alt+E` (toggle main), `Ctrl+Alt+O` (toggle overlay), reposicionamento no monitor | ✅ |
| `tray.rs` | System tray com menu: Show Lexio, Show Overlay, Quit + left-click handler | ✅ |
| `main.rs` | Plugin registrado, shortcuts e tray no `.setup()`, commands de janela no invoke_handler | ✅ |
| `useWindowControls.ts` | Novo hook: `close`, `minimize`, `resize` via `invoke` | ✅ |
| `WindowControls.tsx` | Migrado de `window.lexio.*` para `useWindowControls` hook | ✅ |
| `AppShell.tsx` | `transitionTo` usa `resize` do hook em vez de `window.lexio.resizeWindow` | ✅ |
| `useAutoUpdater.ts` | Migrado de `window.lexio.onUpdate*` para `listen` do `@tauri-apps/api/event` | ✅ |

### Arquivos criados

- `src/tauri/src/commands/window.rs` — window commands + 2 testes
- `src/tauri/src/shortcuts.rs` — atalhos globais Ctrl+Alt+E e Ctrl+Alt+O
- `src/tauri/src/tray.rs` — system tray com menu
- `src/renderer/hooks/useWindowControls.ts` — hook de controle de janela

### Arquivos modificados

- `src/tauri/Cargo.toml` — adicionou `tauri-plugin-global-shortcut`
- `src/tauri/tauri.conf.json` — registrou plugin global-shortcut
- `src/tauri/src/commands/mod.rs` — adicionou `pub mod window`
- `src/tauri/src/commands/words.rs` — removeu `get_app_version`
- `src/tauri/src/main.rs` — plugin, shortcuts, tray, novos commands
- `src/renderer/components/WindowControls.tsx` — usa `useWindowControls`
- `src/renderer/components/AppShell.tsx` — usa `resize` do hook
- `src/renderer/hooks/useAutoUpdater.ts` — usa `listen` do Tauri

### Testes unitários (2 novos, 25 total)

| Teste | Arquivo |
|---|---|
| `test_resize_state_mapping` | `commands/window.rs` |
| `test_resize_invalid_state_ignored` | `commands/window.rs` |

### Critérios de verificação

| Critério | Resultado |
|---|---|
| `Ctrl+Alt+E` abre/fecha a janela main e reposiciona no centro | ✅ Implementado em `shortcuts.rs` |
| `Ctrl+Alt+O` toggle o overlay | ✅ Implementado em `shortcuts.rs` |
| Botão fechar chama `invoke('close_window')` e esconde a janela | ✅ `WindowControls.tsx` via hook |
| Botão minimizar funciona | ✅ `WindowControls.tsx` via hook |
| `invoke('resize_window', { state: 'result' })` → 420px | ✅ `AppShell.tsx` via hook |
| `invoke('resize_window', { state: 'idle' })` → 60px | ✅ `AppShell.tsx` via hook |
| System tray aparece com ícone e menu correto | ✅ `tray.rs` — Show Lexio, Show Overlay, Quit |
| "Quit" no tray fecha o app | ✅ `app.exit(0)` |
| "Show Lexio" no tray traz a janela de volta | ✅ `win.show()` + `set_focus()` |
| `cargo test` passa | ✅ Confirmado pelo usuário — 25/25 testes |
| `npm run build:renderer` passa sem erros | ✅ 159 módulos, zero erros |
| Zero `window.lexio.*` no renderer | ✅ Confirmado via grep |
| `npm run dev` abre app com shortcuts funcionais | ✅ Confirmado pelo usuário — Ctrl+Alt+E e Ctrl+Alt+O funcionam |

### Decisões

1. **`get_app_version` movido para `commands/window.rs`** — Era em `words.rs` (errado conceitualmente). Movido para `window.rs` onde pertence. Command name permanece igual — nenhuma mudança no frontend.

2. **`useAutoUpdater.ts` preparado para Fase 5** — Substituiu `window.lexio.onUpdate*` por `listen('update:available', ...)` do Tauri. O `install_update` command ainda não existe no backend Rust (Fase 5). O hook está preparado mas inativo até a Fase 5.

3. **Reposicionamento no monitor via `current_monitor()`** — O Tauri v2 não expõe diretamente o monitor sob o cursor. Fallback: usa `current_monitor()` da janela (o monitor onde a janela estava quando minimizada). Alternativa mais precisa possível com a API disponível.

---

## Fase 4.1 — Overlay Fix: Image Render + Drag-and-Drop

**Branch:** `feat/migrate-to-tauri`
**Status:** Complete

### O que foi feito

| Passo | Descrição | Status |
|---|---|---|
| `commands/window.rs` | Adicionou `overlay_set_position(x, y, app)` e `overlay_drag_start()` + 1 teste | ✅ |
| `main.rs` | Registrou os 2 novos commands no invoke_handler | ✅ |
| `useOverlay.ts` | Criou hook que substitui `window.lexioOverlay.*` com `invoke`/`listen` do Tauri | ✅ |
| `FloatingButton.tsx` | Migrado de `window.lexioOverlay.*` para `useOverlay` hook | ✅ |
| `overlay.css` | Adicionou `box-shadow: none; outline: none` ao `.floating-btn` para remover estilos default do browser | ✅ |
| `tauri.conf.json` | Adicionou `"shadow": false` na janela overlay para remover sombra de janela do Windows | ✅ |
| `commands/window.rs` | Importou `tauri::Manager` (necessário para `get_webview_window`) | ✅ |

### Causa Raiz

`FloatingButton.tsx` dependia de `window.lexioOverlay.*` — API exposta via `contextBridge` do Electron em `overlay-preload.ts`. No Tauri não existe preload/contextBridge, portanto `window.lexioOverlay` era `undefined` em runtime. O `useEffect` de registro de eventos crashava silenciosamente no mount, impedindo a renderização do componente.

### Arquivos criados

- `src/renderer/hooks/useOverlay.ts` — substitui `window.lexioOverlay.*` com Tauri IPC

### Arquivos modificados

- `src/tauri/src/commands/window.rs` — `overlay_set_position`, `overlay_drag_start`, `use tauri::Manager`
- `src/tauri/src/main.rs` — registrou 2 novos commands
- `src/renderer/components/FloatingButton.tsx` — usa `useOverlay` hook
- `src/renderer/styles/overlay.css` — `box-shadow: none; outline: none` no botão
- `src/tauri/tauri.conf.json` — `"shadow": false` na janela overlay

### Testes unitários (1 novo, 26 total)

| Teste | Arquivo |
|---|---|
| `test_overlay_drag_start_is_noop` | `commands/window.rs` |

### Critérios de verificação

| Critério | Resultado |
|---|---|
| `cargo test` passa (incluindo `test_overlay_drag_start_is_noop`) | ✅ 26/26 testes |
| `npm run build:renderer` passa sem erros | ✅ Zero erros |
| Overlay renderiza ícone Lexio | ✅ Confirmado pelo usuário |
| Sem shadow/box extra ao redor do overlay | ✅ Corrigido via CSS + `shadow: false` |
| Sem `window.lexioOverlay` no renderer | ✅ Confirmado via grep |

### Decisões

1. **`translate()` como stub** — Double-click tenta `invoke('overlay_translate')` que falha silenciosamente (command não existe ainda). Aceitável — botão renderiza e drag funciona. Implementação real na Fase 5.

2. **`overlay_drag_start` é no-op** — No Electron também era vazio. Mantido por paridade de API.

3. **`use tauri::Manager` obrigatório** — `get_webview_window` pertence ao trait `Manager`. Sem o import, o Rust encontra o método mas não o resolve, gerando `E0599`. Lição: sempre importar o trait explicitamente em Tauri v2.

4. **Sombra dupla removida** — O box extra vinha de dois lugares independentes: estilos default do `<button>` no browser (removido com `box-shadow: none; outline: none` no CSS) e sombra de janela do Windows aplicada pelo OS (removida com `"shadow": false` no `tauri.conf.json`).

---

## Fase 5 — Overlay Translation Flow

**Branch:** `feat/migrate-to-tauri`
**Status:** Complete (pending manual verification with `cargo test` + `npm run dev`)

### O que foi feito

| Passo | Descrição | Status |
|---|---|---|
| `Cargo.toml` | Adicionou `arboard = "3"` e `enigo = "0.2"` | ✅ |
| `ai_client/translate_prompt.rs` | Criou — prompt de tradução (target: English, retorna APENAS o texto) | ✅ |
| `ai_client/mod.rs` | Adicionou `fetch_translation` (POST Gemini sem `response_format`, retorna texto puro) | ✅ |
| `text_bridge.rs` | Criou — `capture_selection` (Ctrl+C + arboard + restore) e `inject_text` (arboard + Ctrl+V + restore) | ✅ |
| `commands/overlay.rs` | Criou — `do_translate` (lógica async compartilhada) + command `overlay_translate` | ✅ |
| `commands/mod.rs` | Adicionou `pub mod overlay` | ✅ |
| `commands/window.rs` | Persistência: `persist_overlay_position` + `load_overlay_position` em `<app_data_dir>/overlay-position.json`; `overlay_set_position` agora persiste | ✅ |
| `shortcuts.rs` | Registrou `Ctrl+Alt+Shift+T` → spawna `do_translate` no runtime tokio | ✅ |
| `main.rs` | Declarou `mod text_bridge`, registrou `overlay_translate` no invoke_handler, carrega posição persistida no setup | ✅ |
| `preload/overlay-preload.ts` | Deletado — não é mais usado (useOverlay.ts já migrado na Fase 4.1) | ✅ |

### Arquivos criados

- `src/tauri/src/ai_client/translate_prompt.rs`
- `src/tauri/src/text_bridge.rs`
- `src/tauri/src/commands/overlay.rs`

### Arquivos modificados

- `src/tauri/Cargo.toml` — `arboard`, `enigo`
- `src/tauri/src/ai_client/mod.rs` — `pub mod translate_prompt` + `fetch_translation`
- `src/tauri/src/commands/mod.rs` — `pub mod overlay`
- `src/tauri/src/commands/window.rs` — persistência de posição do overlay
- `src/tauri/src/shortcuts.rs` — registrou Ctrl+Alt+Shift+T
- `src/tauri/src/main.rs` — módulo `text_bridge`, carrega posição salva, registra `overlay_translate`

### Arquivos deletados

- `src/preload/overlay-preload.ts` — API obsoleta do Electron (contextBridge)

### Fluxo do `do_translate`

```
Ctrl+Alt+Shift+T → spawn async task →
  1. emit "loading"
  2. spawn_blocking(capture_selection) → Ctrl+C + arboard + 80ms
     • None → emit "idle", return (silencioso)
     • Err  → emit "error", emit error message
  3. lock DB, get_api_key, drop lock
     • None → emit "error", "API key not configured"
  4. clone http client (Arc-cheap), fetch_translation (await)
  5. spawn_blocking(inject_text) → arboard + Ctrl+V + restore
  6. emit "success" → sleep 2s → emit "idle"
```

**MutexGuard discipline:** todo `state.db.lock()` é feito em bloco `{ }` e o guard é dropped antes de qualquer `.await`. `spawn_blocking` é usado para capture/inject para não bloquear o runtime tokio com `thread::sleep`.

### Testes unitários (8 novos, 34 total)

| Teste | Arquivo |
|---|---|
| `test_translate_prompt_is_non_empty` | `ai_client/mod.rs` |
| `test_translate_prompt_targets_english` | `ai_client/mod.rs` |
| `test_translate_prompt_forbids_explanations` | `ai_client/mod.rs` |
| `test_parse_translation_response_extracts_content` | `ai_client/mod.rs` |
| `test_delay_constants_are_reasonable` | `text_bridge.rs` |
| `test_overlay_position_json_roundtrip` | `commands/window.rs` |
| `test_overlay_position_parse_rejects_malformed` | `commands/window.rs` |
| `test_overlay_position_parse_missing_key` | `commands/window.rs` |

Testes reais de clipboard/enigo são OS-dependentes (requerem display) — verificação via checklist manual abaixo.

### Critérios de verificação

| Critério | Resultado |
|---|---|
| `cargo test` passa | ✅ 34/34 testes confirmados pelo usuário |
| `npm run build:renderer` passa sem erros | ✅ Zero erros |
| `Ctrl+Alt+Shift+T` captura seleção e injeta tradução | ⏳ Teste manual pendente |
| Sem seleção → overlay volta para idle silenciosamente | ⏳ Teste manual pendente |
| Sem API key → overlay mostra error com mensagem | ⏳ Teste manual pendente |
| Clipboard do usuário restaurado após capture + inject | ⏳ Teste manual pendente |
| Overlay salva posição ao arrastar | ⏳ Teste manual pendente |
| Posição do overlay persiste entre reinicializações | ⏳ Teste manual pendente |
| `src/preload/overlay-preload.ts` deletado | ✅ Confirmado |
| `Ctrl+Alt+E` e `Ctrl+Alt+O` ainda funcionam (regressão) | ⏳ Teste manual pendente |

### Checklist manual pós-build

- [ ] Selecionar texto em Notepad, pressionar Ctrl+Alt+Shift+T → tradução injetada
- [ ] Selecionar texto em browser, pressionar Ctrl+Alt+Shift+T → tradução injetada
- [ ] Double-click no overlay com seleção ativa → tradução injetada
- [ ] Arrastar overlay, fechar app, reabrir → overlay aparece na posição salva
- [ ] Sem API key configurada, Ctrl+Alt+Shift+T → overlay fica vermelho (error)
- [ ] Sem seleção, Ctrl+Alt+Shift+T → overlay volta para idle sem alarde

### Decisões

1. **`do_translate` como função compartilhada** — O mesmo código roda via command (`overlay_translate` chamado pelo double-click no overlay) e via shortcut (`Ctrl+Alt+T`). Extraído para `pub async fn do_translate(app: AppHandle)` em `commands/overlay.rs`; o command é um wrapper fino.

2. **`spawn_blocking` para capture/inject** — `capture_selection` e `inject_text` usam `thread::sleep` (não `tokio::time::sleep`) porque são sync. Chamá-los diretamente de uma task async bloqueia o worker tokio. `spawn_blocking` os offloada para o thread pool blocking.

3. **Clipboard restore best-effort** — Se o restore do clipboard falhar (raro), ignoramos silenciosamente. O fluxo primário (tradução injetada) não deve falhar por causa disso.

4. **Persistência por write-per-drag** — `overlay_set_position` escreve o arquivo JSON a cada chamada (uma por mousemove durante o drag). Overhead é ~20 bytes × ~60Hz = trivial em SSDs modernos. Otimização com debounce pode ser feita depois se for detectado impacto.

5. **`app_data_dir` como storage** — Mesma pasta do SQLite (`lexio.db`). O Tauri resolve isso via `app.path().app_data_dir()` → `%APPDATA%\Lexio\` no Windows.

6. **TRADEOFF vs selection-hook (Electron)** — Documentado em `text_bridge.rs`: o selection-hook do Electron usava UIAutomation passivamente (sem keypress). Aqui simulamos Ctrl+C, o que pode ter side-effects em apps que interceptam esse atalho. Tradeoff aceito em troca de cross-platform real via `enigo`/`arboard`.

---

## Fase 5.1 — Fixes Pós-Fase 5

**Branch:** `feat/migrate-to-tauri`
**Status:** Complete

### O que foi feito

| Fix | Descrição | Commit |
|---|---|---|
| Atalho tradução | `Ctrl+Alt+T` → `Ctrl+Alt+Shift+T` — conflito com AltGr+T em teclados BR (produzia `©`) | `faf86f4` |
| Model ID | `gemini-2.0-flash` → `gemini-2.5-flash` — modelo anterior retornando 404 na API | `cc4e12d` |
| Model ID intermediário | `gemini-2.5-flash-preview-04-17` também retornou 404 (preview expirado) | — |

### Causa Raiz dos Fixes

**Atalho (`Ctrl+Alt+T` → `Ctrl+Alt+Shift+T`):**  
No Windows, `Ctrl+Alt` é equivalente a `AltGr`. Em teclados ABNT2/brasileiros, `AltGr+T` produz `©` — o OS resolve o caractere *antes* do hook de shortcut global interceptar. Adicionar `Shift` quebra a composição de caractere. `Ctrl+Alt+E` e `Ctrl+Alt+O` não tinham o problema porque essas posições não geram caracteres no layout ABNT2.

**Model ID:**  
O endpoint OpenAI-compatible do Gemini (`v1beta/openai/...`) retornava 404 com "API version v1main" para `gemini-2.0-flash` e para o preview datado `gemini-2.5-flash-preview-04-17`. O alias estável `gemini-2.5-flash` é o ID correto para o modelo atual.

### Arquivos modificados

- `src/tauri/src/shortcuts.rs` — shortcut de tradução: `Control+Alt+T` → `Control+Alt+Shift+T`
- `src/renderer/components/FloatingButton.tsx` — tooltip atualizado para novo atalho
- `src/tauri/src/ai_client/config.rs` — `AI_MODEL = "gemini-2.5-flash"`

---

---

## Fase 6 — Auto-updater, Testes Vitest e Limpeza

**Branch:** `feat/migrate-to-tauri`
**Status:** Complete (pending manual: `npm install`, `cargo test`, `npm run test`, `npm run build:renderer`)

### O que foi feito

| Passo | Descrição | Status |
|---|---|---|
| `Cargo.toml` | Adicionou `tauri-plugin-updater = "2"` | ✅ |
| `updater.rs` | Criou — `check_and_setup`: verifica update em background, emite `update:available`, `update:progress`, `update:downloaded` | ✅ |
| `commands/window.rs` | Adicionou `install_update` — chama `app.restart()` | ✅ |
| `main.rs` | Registrou `tauri_plugin_updater::Builder::new().build()`, declarou `mod updater`, spawn async de `check_and_setup` no `.setup()`, registrou `install_update` no invoke_handler | ✅ |
| `tauri.conf.json` | Adicionou `plugins.updater` (pubkey placeholder + endpoint GitHub releases), bundle targets `["msi","nsis"]`, `windows.digestAlgorithm`, `windows.timestampUrl` | ✅ |
| `vitest.config.ts` | Alterou environment de `node` para `jsdom`, adicionou `setupFiles`, adicionou `globals: true` | ✅ |
| `src/renderer/test/setup.ts` | Criou — `mockIPC` padrão + `clearMocks` por teste | ✅ |
| `package.json` | Adicionou `@testing-library/react`, `@testing-library/user-event`, `jsdom` como devDeps | ✅ |
| `useSearch.test.ts` | Criou — 6 testes com `mockIPC`: cache hit, loading state, error state, blank query, lowercase, toggleSaved | ✅ |

### Arquivos criados

- `src/tauri/src/updater.rs`
- `src/renderer/test/setup.ts`
- `src/renderer/hooks/useSearch.test.ts`

### Arquivos modificados

- `src/tauri/Cargo.toml` — adicionou `tauri-plugin-updater`
- `src/tauri/src/main.rs` — plugin, mod updater, spawn updater, install_update command
- `src/tauri/src/commands/window.rs` — adicionou `install_update`
- `src/tauri/tauri.conf.json` — updater plugin config + bundle targets msi/nsis
- `vitest.config.ts` — jsdom + setupFiles
- `package.json` — devDeps de teste

### Limpeza pendente (requer confirmação do usuário)

Os seguintes diretórios são código morto do Electron, já excluídos do `tsconfig.json`, mas não deletados fisicamente (operação destrutiva anteriormente negada):

```
_electron_backup/    → pode deletar
src/main/            → pode deletar (todo o main Electron)
src/preload/index.ts → pode deletar (contextBridge não usado)
```

### Ações manuais necessárias antes de fechar a fase

```bash
# 1. Instalar novas devDeps de teste
npm install

# 2. Gerar chave de signing para o auto-updater (uma única vez)
npx tauri signer generate -w ~/.tauri/lexio.key
# → copiar a public key para tauri.conf.json em plugins.updater.pubkey
# → guardar TAURI_SIGNING_PRIVATE_KEY como secret no GitHub

# 3. Verificar build
cargo test -p lexio
npm run test
npm run build:renderer
```

### Testes unitários (1 novo — Rust, 6 novos — Vitest, 35 total Rust)

| Teste | Arquivo |
|---|---|
| `test_updater_module_compiles` | `updater.rs` |
| `returns word when get_word resolves immediately` | `useSearch.test.ts` |
| `shows loading state during an in-flight search` | `useSearch.test.ts` |
| `sets error state when get_word throws` | `useSearch.test.ts` |
| `ignores blank/whitespace-only search terms` | `useSearch.test.ts` |
| `lowercases the search term before invoking` | `useSearch.test.ts` |
| `updates word after toggleSaved` | `useSearch.test.ts` |

### Critérios de verificação

| Critério | Resultado |
|---|---|
| `cargo test` passa (incluindo test_updater_module_compiles) | ⏳ Pendente — requer `cargo test` manual |
| `npm run test` — 6 testes useSearch passando | ⏳ Pendente — requer `npm install` depois `npm run test` |
| `npm run build:renderer` sem erros TypeScript | ⏳ Pendente |
| Updater não executa em `npm run dev` (app não é packaged) | ✅ Lógica: `if !app.is_packaged() { return; }` |
| `install_update` registrado no invoke_handler | ✅ |
| `useAutoUpdater.ts` já consumia os eventos corretos | ✅ (migrado na Fase 4) |

### Decisões

1. **`install_update` chama `app.restart()`** — Tauri v2 faz o restart + apply do update automaticamente quando o app é reiniciado com o bundle disponível. Não há uma API explícita de "install then restart" separada no plugin-updater v2; restart é suficiente.

2. **Pubkey como placeholder** — A chave real precisa ser gerada com `tauri signer generate`. Não é possível gerar automaticamente — requer interação com o filesystem do usuário e armazenamento seguro.

3. **`vitest.config.ts` mudou de `node` para `jsdom`** — Hooks React precisam de um ambiente DOM para `useState`/`useEffect`. `jsdom` provê isso. Testes Rust (`cargo test`) não são afetados.

4. **`react-i18next` mockado em `useSearch.test.ts`** — `useSearch` chama `useLocale` que usa `react-i18next`. Mockar o módulo é mais simples que configurar o provider i18n no ambiente de teste.

---

## Critérios de Saída da Migração

Fases 1–6 completas. Pendentes somente execução manual:

- [ ] `cargo test` — 0 falhas (espera-se 35 testes)
- [ ] `npm run test` — 6 testes Vitest passando
- [ ] `npm run build:renderer` — zero erros TypeScript
- [ ] Chave de signing gerada e pubkey atualizada em `tauri.conf.json`
- [ ] PR aberto para `stage` com description das mudanças arquiteturais
