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

## Próximas Fases

- **Fase 3** — AI client em Rust (Groq API), remover `ai.ts` do renderer
- **Fase 4** — Shortcuts globais, system tray, overlay em Tauri
- **Fase 5** — Auto-updater, build/release pipeline, cleanup do backup Electron
