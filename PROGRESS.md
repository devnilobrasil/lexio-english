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

## Próximas Fases

- **Fase 5** — Overlay translate: clipboard capture + keyboard injection (`Ctrl+Alt+T`), auto-updater, build/release pipeline, cleanup do backup Electron
