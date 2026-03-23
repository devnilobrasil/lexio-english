# Lexio — PRD & Guia de Desenvolvimento

> App desktop de aprendizado de inglês sob demanda.  
> O aluno constrói o próprio vocabulário, palavra por palavra.

---

## Stack

| Camada | Tecnologia | Motivo |
|---|---|---|
| Shell desktop | **Electron v33+** | Cross-platform, atalho global, system tray |
| UI | **React 18 + Vite + TypeScript** | Build estático, tipagem, hot reload no dev |
| Estilos | **Tailwind CSS v3** | Utilitário, rápido de iterar |
| Base de dados | **better-sqlite3** + `@types/better-sqlite3` | Síncrono, rápido, arquivo local único |
| IA | **Claude API** (`claude-sonnet-4-20250514`) | Gera significado, exemplos, fonética |
| IPC | Electron `contextBridge` com tipos declarados | Comunicação segura e tipada main ↔ renderer |

**Por que não Next.js?**  
Next.js precisa de servidor Node para SSR/rotas de API. Electron não tem servidor — carrega HTML estático. Next.js em Electron significa rodar um servidor dentro do app ou usar `next export`, o que quebra metade das features do framework. React + Vite é a combinação certa: build estático, zero overhead.

**Por que SQLite e não Supabase?**  
App offline-first. Sem dependência de rede para funcionar. O ficheiro `.db` vive em `userData` do sistema operativo (ver abaixo). No futuro, pode adicionar sync com Supabase sem mudar o schema.

---

## Estrutura de Ficheiros

```
lexio/
├── package.json
├── tsconfig.json                 # config base TS
├── tsconfig.main.json            # config TS para o processo main (CommonJS)
├── tsconfig.renderer.json        # config TS para o renderer (ESModules)
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── electron-builder.yml
├── public/
│   └── icon.png                  # ícone do app (512x512)
└── src/
    ├── types/
    │   └── index.ts              # tipos partilhados entre main e renderer
    ├── main/
    │   ├── index.ts              # processo principal Electron
    │   ├── db.ts                 # todas as operações SQLite
    │   ├── ipc.ts                # handlers IPC centralizados
    │   ├── shortcut.ts           # registo do atalho global
    │   └── tray.ts               # ícone na system tray
    ├── preload/
    │   └── index.ts              # contextBridge tipado (ponte main ↔ renderer)
    └── renderer/
        ├── index.html
        ├── main.tsx              # entry point React
        ├── App.tsx               # roteamento de views
        ├── styles/
        │   └── globals.css       # Tailwind base
        ├── components/
        │   ├── SearchBar.tsx
        │   ├── WordCard.tsx
        │   ├── ExampleItem.tsx
        │   ├── HistoryList.tsx
        │   ├── SavedWords.tsx
        │   └── TitleBar.tsx      # barra de título customizada (frameless)
        ├── hooks/
        │   ├── useSearch.ts      # lógica de busca + chamada Claude API
        │   └── useWords.ts       # CRUD de palavras via IPC
        └── lib/
            └── claude.ts         # wrapper da Claude API
```

---

## Tipos Partilhados

```ts
// src/types/index.ts

export interface WordExample {
  en: string
  pt: string
}

export type PartOfSpeech = 'verb' | 'noun' | 'adjective' | 'adverb' | 'phrase' | 'idiom'
export type WordLevel = 'Básico' | 'Intermediário' | 'Avançado' | 'Técnico'

export interface Word {
  id?: number
  word: string
  phonetic: string | null
  pos: PartOfSpeech | null
  level: WordLevel | null
  meaning_pt: string
  meaning_en: string | null
  examples: WordExample[]
  synonyms: string[]
  contexts: string[]
  created_at?: string
  last_viewed?: string
  view_count?: number
  is_saved?: 0 | 1
}

// O que a Claude API devolve (antes de entrar no DB)
export type ClaudeWordResponse = Omit<Word, 'id' | 'created_at' | 'last_viewed' | 'view_count' | 'is_saved'>

// API IPC exposta ao renderer via contextBridge
export interface LexioAPI {
  getWord:        (word: string)              => Promise<Word | null>
  saveWord:       (data: ClaudeWordResponse)  => Promise<Word>
  toggleSaved:    (word: string)              => Promise<Word>
  deleteWord:     (word: string)              => Promise<void>
  getHistory:     (limit?: number)            => Promise<Word[]>
  getSaved:       ()                          => Promise<Word[]>
  closeWindow:    ()                          => void
  minimizeWindow: ()                          => void
}

// Augment global window para o renderer reconhecer window.lexio
declare global {
  interface Window {
    lexio: LexioAPI
  }
}
```

---

## Schema SQLite

```sql
CREATE TABLE IF NOT EXISTS words (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  word         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phonetic     TEXT,
  pos          TEXT,
  level        TEXT,
  meaning_pt   TEXT NOT NULL,
  meaning_en   TEXT,
  examples     TEXT,   -- JSON: [{en, pt}, ...]
  synonyms     TEXT,   -- JSON: ["string", ...]
  contexts     TEXT,   -- JSON: ["Negócios", ...]
  created_at   TEXT DEFAULT (datetime('now')),
  last_viewed  TEXT DEFAULT (datetime('now')),
  view_count   INTEGER DEFAULT 1,
  is_saved     INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_word    ON words(word);
CREATE INDEX IF NOT EXISTS idx_saved   ON words(is_saved);
CREATE INDEX IF NOT EXISTS idx_created ON words(created_at DESC);
```

**Localização do ficheiro `.db` por OS:**

| OS | Caminho |
|---|---|
| macOS | `~/Library/Application Support/lexio/lexio.db` |
| Windows | `%APPDATA%\lexio\lexio.db` |
| Linux | `~/.config/lexio/lexio.db` |

Obtido via `app.getPath('userData')` no processo main.

---

## Arquitetura IPC (Main ↔ Renderer)

O renderer **nunca** acessa o filesystem ou SQLite diretamente.  
Toda comunicação passa pelo `contextBridge` no preload, tipado com `LexioAPI`.

### Preload

```ts
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import type { LexioAPI } from '../types'

const api: LexioAPI = {
  getWord:        (word)        => ipcRenderer.invoke('word:get', word),
  saveWord:       (data)        => ipcRenderer.invoke('word:save', data),
  toggleSaved:    (word)        => ipcRenderer.invoke('word:toggleSaved', word),
  deleteWord:     (word)        => ipcRenderer.invoke('word:delete', word),
  getHistory:     (limit = 30)  => ipcRenderer.invoke('word:history', limit),
  getSaved:       ()            => ipcRenderer.invoke('word:saved'),
  closeWindow:    ()            => ipcRenderer.send('window:close'),
  minimizeWindow: ()            => ipcRenderer.send('window:minimize'),
}

contextBridge.exposeInMainWorld('lexio', api)
```

### Handlers no Main

```ts
// src/main/ipc.ts
import { ipcMain, BrowserWindow } from 'electron'
import * as db from './db'

export function registerIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle('word:get',         (_, word: string)        => db.getWord(word))
  ipcMain.handle('word:save',        (_, data)                => db.upsertWord(data))
  ipcMain.handle('word:toggleSaved', (_, word: string)        => db.toggleSaved(word))
  ipcMain.handle('word:delete',      (_, word: string)        => db.deleteWord(word))
  ipcMain.handle('word:history',     (_, limit: number = 30)  => db.getHistory(limit))
  ipcMain.handle('word:saved',       ()                       => db.getSaved())

  ipcMain.on('window:close',    () => win.hide())
  ipcMain.on('window:minimize', () => win.minimize())
}
```

---

## Fluxo de Busca de Palavra

```
Usuário digita "churn" + Enter
        │
        ▼
[renderer] useSearch.ts
  1. Chama window.lexio.getWord("churn")
  2. Se já existe no DB → renderiza direto (sem chamar API)
  3. Se não existe → chama claude.ts
        │
        ▼
[renderer] claude.ts
  POST https://api.anthropic.com/v1/messages
  → retorna ClaudeWordResponse (tipado)
        │
        ▼
[renderer] useSearch.ts
  4. Chama window.lexio.saveWord(resultado)
        │
        ▼
[main] db.ts
  5. Faz upsert na tabela words
  6. Retorna Word completo
        │
        ▼
[renderer] WordCard.tsx renderiza resultado
```

**Cache automático:** Palavra já no banco → carrega instantaneamente sem custo de API.  
`view_count` e `last_viewed` são atualizados a cada visualização.

---

## Claude API Wrapper

```ts
// src/renderer/lib/claude.ts
import type { ClaudeWordResponse } from '../../types'

const SYSTEM_PROMPT = `Você é um dicionário de inglês especializado para falantes de português brasileiro.
Responda APENAS com JSON válido, sem markdown, sem texto extra.`

const buildUserPrompt = (word: string): string => `
Para a palavra "${word}", retorne exatamente este JSON:
{
  "word": "${word}",
  "phonetic": "transcrição IPA, ex: tʃɜːrn",
  "pos": "verb|noun|adjective|adverb|phrase|idiom",
  "level": "Básico|Intermediário|Avançado|Técnico",
  "meaning_pt": "significado completo em português brasileiro",
  "meaning_en": "simple English definition, 1-2 sentences",
  "examples": [
    {"en": "exemplo em inglês", "pt": "tradução natural"},
    {"en": "segundo exemplo",   "pt": "tradução"},
    {"en": "terceiro exemplo",  "pt": "tradução"}
  ],
  "synonyms": ["palavra1", "palavra2", "palavra3"],
  "contexts": ["Negócios", "Tecnologia"]
}
Contextos possíveis: Negócios, Tecnologia, Informal, Formal, Finanças, Marketing, RH, Jurídico, Medicina, Gíria`

export async function fetchWordFromClaude(word: string): Promise<ClaudeWordResponse> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(word) }],
    }),
  })

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`)

  const data = await response.json()
  const text: string = data.content?.[0]?.text ?? ''
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean) as ClaudeWordResponse
}
```

---

## Operações de Base de Dados

```ts
// src/main/db.ts
import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import type { Word, ClaudeWordResponse } from '../types'

// Linha raw do SQLite (campos JSON ainda como string)
interface WordRow extends Omit<Word, 'examples' | 'synonyms' | 'contexts'> {
  examples: string
  synonyms: string
  contexts: string
}

let db: Database.Database

export function init(): void {
  db = new Database(path.join(app.getPath('userData'), 'lexio.db'))
  db.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      word        TEXT NOT NULL UNIQUE COLLATE NOCASE,
      phonetic    TEXT,
      pos         TEXT,
      level       TEXT,
      meaning_pt  TEXT NOT NULL,
      meaning_en  TEXT,
      examples    TEXT,
      synonyms    TEXT,
      contexts    TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      last_viewed TEXT DEFAULT (datetime('now')),
      view_count  INTEGER DEFAULT 1,
      is_saved    INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_word    ON words(word);
    CREATE INDEX IF NOT EXISTS idx_saved   ON words(is_saved);
    CREATE INDEX IF NOT EXISTS idx_created ON words(created_at DESC);
  `)
}

export function getWord(word: string): Word | null {
  const row = db.prepare('SELECT * FROM words WHERE word = ?').get(word) as WordRow | undefined
  if (!row) return null
  db.prepare(
    `UPDATE words SET view_count = view_count + 1, last_viewed = datetime('now') WHERE word = ?`
  ).run(word)
  return deserialize(row)
}

export function upsertWord(data: ClaudeWordResponse): Word {
  db.prepare(`
    INSERT INTO words (word, phonetic, pos, level, meaning_pt, meaning_en, examples, synonyms, contexts)
    VALUES (@word, @phonetic, @pos, @level, @meaning_pt, @meaning_en, @examples, @synonyms, @contexts)
    ON CONFLICT(word) DO UPDATE SET
      last_viewed = datetime('now'),
      view_count  = view_count + 1
  `).run(serialize(data))
  return getWord(data.word)!
}

export function toggleSaved(word: string): Word {
  db.prepare(
    `UPDATE words SET is_saved = CASE WHEN is_saved = 1 THEN 0 ELSE 1 END WHERE word = ?`
  ).run(word)
  return getWord(word)!
}

export function deleteWord(word: string): void {
  db.prepare('DELETE FROM words WHERE word = ?').run(word)
}

export function getHistory(limit = 30): Word[] {
  return (
    db.prepare('SELECT * FROM words ORDER BY last_viewed DESC LIMIT ?').all(limit) as WordRow[]
  ).map(deserialize)
}

export function getSaved(): Word[] {
  return (
    db.prepare('SELECT * FROM words WHERE is_saved = 1 ORDER BY word ASC').all() as WordRow[]
  ).map(deserialize)
}

function serialize(data: ClaudeWordResponse) {
  return {
    ...data,
    examples: JSON.stringify(data.examples ?? []),
    synonyms: JSON.stringify(data.synonyms ?? []),
    contexts: JSON.stringify(data.contexts ?? []),
  }
}

function deserialize(row: WordRow): Word {
  return {
    ...row,
    examples: JSON.parse(row.examples ?? '[]'),
    synonyms: JSON.parse(row.synonyms ?? '[]'),
    contexts: JSON.parse(row.contexts ?? '[]'),
  }
}
```

---

## Janela Electron

```ts
// src/main/index.ts
import { app, BrowserWindow, screen } from 'electron'
import path from 'path'
import { registerShortcut } from './shortcut'
import { createTray } from './tray'
import { registerIpcHandlers } from './ipc'
import * as db from './db'

const isDev = !app.isPackaged

app.whenReady().then(() => {
  db.init()

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width: 720,
    height: 620,
    x: Math.round((sw - 720) / 2),
    y: Math.round((sh - 620) / 2),
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  isDev
    ? win.loadURL('http://localhost:5173')
    : win.loadFile(path.join(__dirname, '../../dist/index.html'))

  win.on('blur', () => { if (!isDev) win.hide() })

  registerIpcHandlers(win)
  registerShortcut(win)
  createTray(win)
})

app.on('will-quit', () => {
  require('electron').globalShortcut.unregisterAll()
})
```

### Atalho Global

```ts
// src/main/shortcut.ts
import { globalShortcut, screen, BrowserWindow } from 'electron'

export function registerShortcut(win: BrowserWindow): void {
  const shortcut = process.platform === 'darwin' ? 'Command+Shift+E' : 'Control+Shift+E'

  globalShortcut.register(shortcut, () => {
    if (win.isVisible()) {
      win.hide()
    } else {
      const cursor = screen.getCursorScreenPoint()
      const { x, y, width, height } = screen.getDisplayNearestPoint(cursor).workArea
      const [w, h] = win.getSize()
      win.setPosition(Math.round(x + (width - w) / 2), Math.round(y + (height - h) / 2))
      win.show()
      win.focus()
    }
  })
}
```

### System Tray

```ts
// src/main/tray.ts
import { app, Menu, Tray, nativeImage, BrowserWindow } from 'electron'
import path from 'path'

export function createTray(win: BrowserWindow): Tray {
  const icon = nativeImage
    .createFromPath(path.join(__dirname, '../../public/icon.png'))
    .resize({ width: 16 })

  const tray = new Tray(icon)
  tray.setToolTip('Lexio')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Lexio',          click: () => { win.show(); win.focus() } },
    { type: 'separator' },
    { label: 'Atalho: Ctrl+Shift+E', enabled: false },
    { type: 'separator' },
    { label: 'Sair',                 click: () => app.quit() },
  ]))
  tray.on('click', () => { win.show(); win.focus() })
  return tray
}
```

---

## Barra de Título Customizada

```tsx
// src/renderer/components/TitleBar.tsx
import React from 'react'

export function TitleBar() {
  return (
    <div
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      className="h-10 flex items-center justify-between px-4 select-none"
    >
      <span className="text-sm font-medium opacity-60">Lexio</span>
      <button
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        onClick={() => window.lexio.closeWindow()}
        className="opacity-40 hover:opacity-100 transition-opacity text-xl leading-none"
      >
        ×
      </button>
    </div>
  )
}
```

---

## Configuração TypeScript

```jsonc
// tsconfig.json (base)
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "strict": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

```jsonc
// tsconfig.main.json — processo main e preload (Node/CommonJS)
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "outDir": "dist-main",
    "types": ["node", "electron"]
  },
  "include": ["src/main/**/*", "src/preload/**/*", "src/types/**/*"]
}
```

```jsonc
// tsconfig.renderer.json — React (ESModules)
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src/renderer/**/*", "src/types/**/*"]
}
```

---

## package.json

```json
{
  "name": "lexio",
  "version": "1.0.0",
  "main": "dist-main/main/index.js",
  "scripts": {
    "dev": "concurrently \"npm run dev:renderer\" \"wait-on http://localhost:5173 && electron .\"",
    "dev:renderer": "vite",
    "build": "tsc -p tsconfig.main.json && vite build && electron-builder",
    "build:mac": "npm run build -- --mac",
    "build:win": "npm run build -- --win",
    "build:linux": "npm run build -- --linux"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "concurrently": "^9.1.2",
    "electron": "^33.3.1",
    "electron-builder": "^25.1.8",
    "postcss": "^8.5.1",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.0",
    "vite": "^6.0.7",
    "wait-on": "^8.0.1"
  },
  "dependencies": {
    "better-sqlite3": "^11.7.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

---

## Setup Local — Passo a Passo

```bash
# 1. Criar pasta e entrar
mkdir lexio && cd lexio

# 2. Instalar dependências
npm install

# 3. Reconstruir módulos nativos para a versão do Electron
npx electron-rebuild

# 4. Criar ficheiro .env na raiz
echo "VITE_ANTHROPIC_API_KEY=sk-ant-..." > .env

# 5. Rodar em modo dev
npm run dev
# Inicia Vite em :5173 e Electron em seguida
# Atalho Ctrl+Shift+E (ou Cmd+Shift+E no Mac) abre/fecha a janela

# 6. Build para distribuição
npm run build:mac    # macOS  → .dmg
npm run build:win    # Windows → .exe (NSIS)
npm run build:linux  # Linux  → .AppImage
```

> **Nota sobre `better-sqlite3`:** usa módulos nativos em C++. O `npx electron-rebuild` é necessário para compilá-los contra a versão certa do Electron. Sem isso, o app crashará ao tentar abrir o banco.

---

## Views do App (Fase 1)

### 1. Search View (principal)
- Input grande no topo com foco automático ao abrir
- Resultado: fonética IPA, classe gramatical, nível de dificuldade
- Significado em PT-BR (destaque) + definição em inglês
- 3 exemplos práticos com tradução
- Sinônimos como chips clicáveis (clica → busca aquela palavra)
- Contextos como badges coloridos (Negócios, Tech, etc.)
- Botão "Salvar" / "Remover dos salvos"
- Histórico recente em chips abaixo do input

### 2. Saved Words View
- Lista de palavras salvas em ordem alfabética
- Clique abre o WordCard completo
- Botão para remover dos salvos

### 3. Settings View (mínimo)
- Campo para API Key (com toggle mostrar/esconder)
- Atalho de teclado atual
- Botão para limpar histórico
- Versão do app

---

## Decisões de Design

| Decisão | Escolha | Alternativa descartada | Motivo |
|---|---|---|---|
| Linguagem | **TypeScript** | JavaScript | Tipos partilhados entre main/preload/renderer evitam bugs de IPC |
| Framework UI | React + Vite | Next.js | Next.js precisa de servidor; Electron carrega HTML estático |
| DB | better-sqlite3 | Supabase | Offline-first; sem dependência de rede |
| Janela | `frame: false` | Frame nativo | Controle total do design; igual em todos os OS |
| API | Anthropic Claude | OpenAI GPT | Melhor em PT-BR, JSON estruturado mais consistente |
| Atalho | `Ctrl/Cmd+Shift+E` | `Ctrl+Space` | `Ctrl+Space` conflita com IMEs e Spotlight |
| Cache | SQLite automático | Sem cache | Palavras já buscadas carregam instantaneamente, sem custo de API |
