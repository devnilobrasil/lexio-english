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
| `cargo check` passa (sem erros Rust) | ⏳ Aguardando teste do usuário (guide abaixo) |
| App Tauri abre com `npm run dev` | ✅ Verificado pelo usuário — ambas as janelas aparecem |
| Janela `main` (600×60) aparece, transparente, sem borda | ✅ Confirmado pelo usuário |
| Janela `overlay` (48×48) aparece | ✅ Confirmado pelo usuário |
| Frontend React renderiza na janela main | ✅ Confirmado pelo usuário |
| Zero referências a `electron` causam crash | ✅ Confirmado — app roda sem erros |

### Como Testar `cargo check` (Guia Passo-a-Passo)

O `cargo check` **não compila o app**, apenas verifica se o código Rust está correto (sem erros de sintaxe, tipos, etc.). É muito mais rápido que um build completo — ~30-60 segundos na primeira run (download das dependências).

#### Passo 1: Abra um terminal

```bash
# Certifique-se de que você está no worktree:
cd /path/to/lexio/.worktrees/migrate-to-tauri
```

#### Passo 2: Execute `cargo check` a partir da raiz do worktree

```bash
# Da raiz do worktree (não precisa entrar em src/tauri/)
cargo check -p lexio
```

**Esperado:** você vê logs como:
```
   Compiling lexio v0.1.0
    Checking lexio v0.1.0
     Finished check [unoptimized + debuginfo] target(s) in 45.23s
```

Se tudo passar, você verá `✓ Finished` no fim. **Não há erro.**

#### Passo 4: Possíveis erros (e soluções)

| Erro | Solução |
|---|---|
| `cargo: command not found` | Rust não instalado. Execute `rustup` (já deve estar em PATH) |
| `error: failed to resolve: use of undeclared type...` | Erro no código Rust. Me mostre o erro completo |
| `error: could not compile...` | Dependência faltando. Execute `cargo update` e tente novamente |
| Leva **mais de 2 minutos** | Normal na 1ª run (download crates). Próximas runs são <5s |

#### Passo 5: Se passar, confirme para mim

```
✅ `cargo check` passou
```

Aí eu atualizo o PROGRESS.md.

---

### Dificuldades e decisões

1. **`tsc -b` vs `tsc -p tsconfig.renderer.json`** — O plano indicava `tsc -b`, mas como `tsconfig.json` na raiz não tem project references configuradas e os arquivos `src/main/` ainda existem (com imports de `electron` e `better-sqlite3` removidos do npm), `tsc -b` compilaria esses arquivos e falharia. Decisão: usar `tsc -p tsconfig.renderer.json` no script `build:renderer`, que aponta explicitamente para os arquivos do renderer. Mais robusto e previsível.

2. **Remoção de `src/main/` e `src/preload/`** — O usuário negou o `rm -rf` (operação destrutiva). Alternativa: adicionou `exclude` no `tsconfig.json` para ignorar esses diretórios durante a compilação. Os arquivos originais permanecem em `src/main/` e `src/preload/` além do backup em `_electron_backup/`.

3. **Localização do `tauri.conf.json`** — O plano original colocava o arquivo na raiz do projeto. O CLI do Tauri achou lá e `npm run dev` funcionou, mas `cargo check` falhou: o `tauri-build` procura o config na mesma pasta do `Cargo.toml` (`src/tauri/`). Correção: movido para `src/tauri/tauri.conf.json`; adicionado `Cargo.toml` workspace na raiz para que o CLI do Tauri descubra o crate automaticamente. Caminhos ajustados: `frontendDist: "../../dist"` e ícones com `"icons/..."` (relativos a `src/tauri/`).

4. **`cargo check` não executável no sandbox** — Binários nativos como `cargo.exe` não podem ser executados pelo Claude Code CLI no Windows. A verificação do backend Rust deve ser feita manualmente pelo usuário via `cargo check -p lexio` na raiz do worktree.

---

## Próximas Fases

- **Fase 2** — IPC básico: AppState com SQLite (rusqlite), primeiros commands Rust
- **Fase 3** — Migrar `getWord`, `saveWord`, `getHistory` do Electron para commands Rust
- **Fase 4** — AI client em Rust (Groq API), remover `ai.ts` do renderer
- **Fase 5** — Shortcuts globais, system tray, overlay em Tauri
- **Fase 6** — Auto-updater, build/release pipeline, cleanup do backup Electron
