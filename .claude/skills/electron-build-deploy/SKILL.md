---
name: electron-build-deploy
description: Sequência correta de build e distribuição do Lexio como app Electron. Inclui rebuild de módulos nativos (better-sqlite3), targets por OS e checklist pré-release.
---

# Electron Build & Deploy Skill

## Por que o Build é Diferente

O Lexio usa `better-sqlite3`, que é um módulo nativo em C++. Precisa ser compilado especificamente para a versão do Node.js **embutida no Electron**, não para o Node.js do sistema. Sem isso, o app fecha imediatamente ao tentar abrir o banco.

---

## Sequência de Build Completa

### 1. Reconstruir módulos nativos (obrigatório após `npm install`)

```bash
npx electron-rebuild
```

Execute sempre que:
- Fez `npm install` pela primeira vez
- Atualizou a versão do Electron no `package.json`
- Mudou de máquina/OS

### 2. Build completo (todos os passos em sequência)

```bash
# O script npm run build executa internamente:
# tsc -p tsconfig.main.json  →  compila main + preload para dist-main/
# npm run build:renderer     →  Vite compila renderer para dist/
# electron-builder           →  empacota o app

npm run build:win    # Windows → .exe (NSIS installer)
npm run build:mac    # macOS  → .dmg
npm run build:linux  # Linux  → .AppImage
```

### 3. Build apenas do renderer (para validar CSS/React sem empacotar)

```bash
npm run build:renderer
# Equivale a: vite build
# Gera dist/ com o HTML/JS/CSS otimizado
```

---

## Dev vs. Produção

| Aspecto | Dev (`npm run dev`) | Produção (build) |
|---|---|---|
| Renderer | Vite dev server em `:5173` | Arquivo estático em `dist/index.html` |
| `isDev` | `true` | `false` |
| DevTools | Aberto automaticamente | Desativado |
| `win.on('blur')` | Não esconde (para debug) | Esconde automaticamente |
| API Key | `.env` (VITE_ANTHROPIC_API_KEY) | Embutida no bundle |

```ts
// src/main/index.ts
const isDev = !app.isPackaged  // false em produção

isDev
  ? win.loadURL('http://localhost:5173')
  : win.loadFile(path.join(__dirname, '../../dist/index.html'))
```

---

## Variáveis de Ambiente

```bash
# .env na raiz (nunca commitar)
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

No build de produção, o Vite embutirá o valor de `VITE_ANTHROPIC_API_KEY` no bundle JavaScript. A chave ficará visível se alguém inspecionar o `.asar`. Isso é aceitável para apps desktop pessoais — não é um servidor público.

**Para produção mais segura (futuro):** mover a chamada Claude API para o processo main e usar `process.env` com variável do sistema.

---

## Estrutura de Saída do Build

```
dist/           ← Renderer compilado (Vite output)
  index.html
  assets/
    main-[hash].js
    main-[hash].css

dist-main/      ← Main + Preload compilados (tsc output)
  main/
    index.js
    db.js
    ipc.js
    shortcut.js
    tray.js
  preload/
    index.js

dist-build/     ← App empacotado (electron-builder output)
  Lexio Setup 1.0.0.exe  (Windows)
  Lexio-1.0.0.dmg        (macOS)
  Lexio-1.0.0.AppImage   (Linux)
```

---

## electron-builder.yml

O arquivo `electron-builder.yml` define nome, ícone e targets. Consultar antes de build:

```bash
cat electron-builder.yml
```

Campos importantes:
- `appId` — identificador único (ex: `com.devnilobrasil.lexio`)
- `icon` — `public/icon.png` (512x512 obrigatório)
- `asar: true` — empacota o código em arquivo `.asar` (padrão)

---

## Checklist Pré-Release

- [ ] `npx electron-rebuild` executado após o último `npm install`
- [ ] `.env` com `VITE_ANTHROPIC_API_KEY` válida
- [ ] `npm run build:renderer` passou sem erros
- [ ] `tsc -p tsconfig.main.json` passou sem erros
- [ ] Testado em modo dev (`npm run dev`) — fluxo de busca funciona
- [ ] Versão atualizada em `package.json` (`"version": "X.Y.Z"`)
- [ ] `public/icon.png` existe e tem 512x512
- [ ] `electron-builder.yml` com `appId` correto

---

## Problemas Comuns

### App crasha ao abrir (tela branca ou fecha imediatamente)

**Causa mais comum:** `better-sqlite3` não foi recompilado para a versão do Electron.

```bash
npx electron-rebuild
npm run build:win  # (ou mac/linux)
```

### "Cannot find module '../preload/index.js'"

**Causa:** `tsc -p tsconfig.main.json` não foi executado antes do `electron-builder`.

```bash
npx tsc -p tsconfig.main.json
npm run build:renderer
npx electron-builder
```

### Vite não encontra variável de ambiente

**Causa:** Variável não prefixada com `VITE_`.

```bash
# ✅ Correto
VITE_ANTHROPIC_API_KEY=sk-ant-...

# ❌ Errado — Vite não expõe ao renderer
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Priority Level: MEDIUM

Seguir a sequência correta previne 90% dos problemas de build.  
`npx electron-rebuild` é o passo mais frequentemente esquecido.
