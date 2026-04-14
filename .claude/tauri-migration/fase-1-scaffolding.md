# Fase 1 — Scaffolding Tauri

**Objetivo:** Criar o esqueleto do projeto Tauri v2 com o renderer React existente funcionando dentro da WebView, sem nenhuma funcionalidade nativa ainda.

**Referência:** `SPEC.md` — Seção 1 (O que muda), Seção 2 (Janelas), Seção 13 Fase 1

---

## Skills e Modelo

**Modelo recomendado:** `claude-sonnet-4-6`
Esta fase é predominantemente configuração (JSON, TOML, Vite config). Não requer raciocínio Rust profundo — Sonnet é suficiente.

**Ler antes de implementar:**

| Skill | Por quê |
|---|---|
| `.claude/skills/tauri-architecture/SKILL.md` | Estrutura de `tauri.conf.json`, declaração das 2 janelas, CSP |
| `.claude/skills/git-workflow/SKILL.md` | Criar branch `feat/migrate-to-tauri`, commits e PR |
| `superpowers:using-git-worktrees` | Isolar a migração sem impactar `stage` |
| `.claude/skills/electron-build-deploy/SKILL.md` | Referência: entender o build atual antes de substituir scripts |

---

## Pré-requisitos

- Rust instalado (`rustup` + target `x86_64-pc-windows-msvc`)
- `cargo` disponível no PATH
- Node.js 20+ com `npm`
- `@tauri-apps/cli` v2: `npm install -D @tauri-apps/cli@next`

Verificar:
```bash
rustc --version   # >= 1.77
cargo --version
npx tauri --version  # >= 2.0
```

---

## Estrutura de Arquivos Alvo

```
lexio/                          ← raiz do projeto (não alterar)
├── src/
│   ├── renderer/               ← não alterar nada
│   ├── types/                  ← não alterar nada
│   └── tauri/                  ← NOVO — backend Rust
│       ├── Cargo.toml
│       ├── build.rs
│       ├── icons/
│       └── src/
│           └── main.rs         ← entry point Rust (mínimo por ora)
├── tauri.conf.json             ← NOVO — configuração Tauri
├── package.json                ← atualizar scripts
└── vite.config.ts              ← ajustar para Tauri dev server
```

> Não criar um projeto separado. O Tauri vive dentro do repo existente ao lado do renderer.

---

## Passo 1 — Inicializar o backend Rust

Na raiz do projeto, criar a pasta `src/tauri/` manualmente e inicializar o crate:

```bash
mkdir src/tauri
cd src/tauri
cargo init --name lexio
```

### `src/tauri/Cargo.toml` inicial

```toml
[package]
name = "lexio"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["tray-icon", "image-ico", "image-png"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = "s"
strip = true
```

### `src/tauri/build.rs`

```rust
fn main() {
    tauri_build::build()
}
```

### `src/tauri/src/main.rs` (mínimo)

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## Passo 2 — Configurar `tauri.conf.json`

Criar na raiz do projeto:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Lexio",
  "version": "0.1.0",
  "identifier": "com.lexio.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "npm run dev:renderer",
    "beforeBuildCommand": "npm run build:renderer"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Lexio",
        "width": 600,
        "height": 60,
        "minWidth": 600,
        "minHeight": 60,
        "resizable": false,
        "decorations": false,
        "transparent": true,
        "skipTaskbar": false,
        "visible": true,
        "center": true,
        "focus": true
      },
      {
        "label": "overlay",
        "title": "Lexio Overlay",
        "width": 48,
        "height": 48,
        "x": 32,
        "y": 200,
        "resizable": false,
        "decorations": false,
        "transparent": true,
        "skipTaskbar": true,
        "alwaysOnTop": true,
        "visible": true,
        "focus": false,
        "url": "overlay.html"
      }
    ],
    "security": {
      "csp": "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

**Nota sobre CSP:** Todas as chamadas AI saem do Rust — o renderer nunca chama a Gemini API diretamente. Nenhum domínio externo precisa estar no `connect-src` desde o início.

---

## Passo 3 — Atualizar `package.json`

Adicionar/substituir scripts:

```json
{
  "scripts": {
    "dev": "tauri dev",
    "dev:renderer": "vite",
    "build": "tauri build",
    "build:renderer": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0"
  }
}
```

Remover do `dependencies`:
- `electron`
- `electron-builder`
- `electron-updater`

Remover do `devDependencies`:
- `@electron-toolkit/preload`
- `@electron-toolkit/utils`

---

## Passo 4 — Ajustar `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Tauri dev server deve escutar em localhost:5173
  server: {
    port: 5173,
    strictPort: true,
    host: 'localhost',
  },
  // Overlay é um segundo entry point HTML
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        overlay: 'overlay.html',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
  // Prevenir que Vite substitua process.env (Tauri usa variáveis próprias)
  envPrefix: ['VITE_', 'TAURI_'],
  define: {
    '__TAURI__': JSON.stringify(true),
  },
})
```

Verificar que `index.html` e `overlay.html` existem na raiz (já devem existir no projeto atual).

---

## Passo 5 — Adaptar o Renderer para Tauri API

Criar `src/renderer/lib/tauri-bridge.ts` — wrapper temporário que abstrai `invoke`:

```ts
// src/renderer/lib/tauri-bridge.ts
// Wrapper sobre @tauri-apps/api/core para facilitar migration incremental
import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import { listen as tauriListen } from '@tauri-apps/api/event'

export const invoke = tauriInvoke
export const listen = tauriListen
```

Este arquivo será usado pelos hooks nas fases seguintes. Não alterar os hooks agora.

---

## Passo 6 — Ícones

Tauri requer ícones em múltiplos formatos. Gerar a partir do ícone existente (`public/logo/icon.ico`):

```bash
npx @tauri-apps/cli icon public/logo/icon.png --output src/tauri/icons
```

Se não houver `.png` do ícone, converter o `.ico` primeiro. Os ícones gerados ficam em `src/tauri/icons/`.

---

## Verificação da Fase 1

Executar:
```bash
npm run dev
```

Critérios de aprovação:
- [ ] App Tauri abre sem erros no terminal Rust
- [ ] Janela `main` (600×60) aparece, transparente, sem borda
- [ ] Janela `overlay` (48×48) aparece no canto da tela
- [ ] Frontend React renderiza corretamente na janela main
- [ ] `npm run build:renderer` passa sem erros TypeScript
- [ ] Nenhuma referência a `electron` ou `window.lexio` causa crash (as chamadas podem falhar silenciosamente por enquanto)

---

## Arquivos Criados Nesta Fase

- `src/tauri/Cargo.toml`
- `src/tauri/build.rs`
- `src/tauri/src/main.rs`
- `src/tauri/icons/` (gerados)
- `tauri.conf.json`
- `src/renderer/lib/tauri-bridge.ts`

## Arquivos Modificados Nesta Fase

- `package.json` (scripts + deps)
- `vite.config.ts`

## Arquivos Removidos Nesta Fase

- `src/main/` (todo o diretório Electron main) — **mover para backup, não deletar ainda**
- `src/preload/` — **mover para backup, não deletar ainda**

> Manter os arquivos Electron em `_electron_backup/` até a Fase 6 para referência.
