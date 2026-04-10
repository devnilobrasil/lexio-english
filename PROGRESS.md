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

## Próximas Fases

- **Fase 4** — Shortcuts globais, system tray, overlay em Tauri
- **Fase 5** — Auto-updater, build/release pipeline, cleanup do backup Electron
