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
| `tauri.conf.json` | Criou na raiz com janelas `main` (600×60) e `overlay` (48×48), CSP e bundle config | ✅ |
| `package.json` | Substituiu scripts Electron por `tauri dev`/`tauri build`; removeu `electron`, `electron-builder`, `electron-updater`, `better-sqlite3`, `@nut-tree-fork/nut-js`, `selection-hook`; adicionou `@tauri-apps/cli`, `@tauri-apps/api` | ✅ |
| `vite.config.ts` | Adicionou `host: 'localhost'`, `envPrefix: ['VITE_', 'TAURI_']`, `define: { __TAURI__ }` | ✅ |
| `tauri-bridge.ts` | Criou `src/renderer/lib/tauri-bridge.ts` — wrapper sobre `invoke`/`listen` | ✅ |
| Ícones Tauri | Gerou todos os formatos via `npx tauri icon` a partir de `lexio-icon-512 1.png` | ✅ |
| Backup Electron | Copiou `src/main/` e `src/preload/` para `_electron_backup/` | ✅ |
| `tsconfig.json` | Adicionou `exclude` para `src/main`, `src/preload`, `_electron_backup` | ✅ |

### Arquivos criados

- `src/tauri/Cargo.toml`
- `src/tauri/build.rs`
- `src/tauri/src/main.rs`
- `src/tauri/icons/` (32x32.png, 128x128.png, 128x128@2x.png, icon.icns, icon.ico + formatos mobile)
- `tauri.conf.json`
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
| `cargo check` passa (sem erros Rust) | ⚠️ Não verificável no sandbox do CLI — executar manualmente com `cd src/tauri && cargo check` |
| App Tauri abre com `npm run dev` | ⚠️ Requer Rust compilado — verificar manualmente |
| Janela `main` (600×60) aparece, transparente, sem borda | ⚠️ Verificar manualmente ao rodar `npm run dev` |
| Janela `overlay` (48×48) aparece | ⚠️ Verificar manualmente ao rodar `npm run dev` |
| Frontend React renderiza na janela main | ⚠️ Verificar manualmente ao rodar `npm run dev` |
| Zero referências a `electron` causam crash | ✅ Código Electron está em backup; renderer não importa Electron |

### Dificuldades e decisões

1. **`tsc -b` vs `tsc -p tsconfig.renderer.json`** — O plano indicava `tsc -b`, mas como `tsconfig.json` na raiz não tem project references configuradas e os arquivos `src/main/` ainda existem (com imports de `electron` e `better-sqlite3` removidos do npm), `tsc -b` compilaria esses arquivos e falharia. Decisão: usar `tsc -p tsconfig.renderer.json` no script `build:renderer`, que aponta explicitamente para os arquivos do renderer. Mais robusto e previsível.

2. **Remoção de `src/main/` e `src/preload/`** — O usuário negou o `rm -rf` (operação destrutiva). Alternativa: adicionou `exclude` no `tsconfig.json` para ignorar esses diretórios durante a compilação. Os arquivos originais permanecem em `src/main/` e `src/preload/` além do backup em `_electron_backup/`.

3. **Caminhos dos ícones no `tauri.conf.json`** — O plano usa `"icons/32x32.png"` mas os ícones foram gerados em `src/tauri/icons/`. O `bundle.icon` no `tauri.conf.json` foi ajustado para `"src/tauri/icons/..."` (relativo à raiz onde `tauri.conf.json` reside).

4. **`cargo check` não executável no sandbox** — Binários nativos como `cargo.exe` não podem ser executados pelo Claude Code CLI no Windows. A verificação do backend Rust deve ser feita manualmente pelo usuário.

---

## Próximas Fases

- **Fase 2** — IPC básico: AppState com SQLite (rusqlite), primeiros commands Rust
- **Fase 3** — Migrar `getWord`, `saveWord`, `getHistory` do Electron para commands Rust
- **Fase 4** — AI client em Rust (Groq API), remover `ai.ts` do renderer
- **Fase 5** — Shortcuts globais, system tray, overlay em Tauri
- **Fase 6** — Auto-updater, build/release pipeline, cleanup do backup Electron
