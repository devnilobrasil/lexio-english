---
name: electron-architecture
description: Padrões de arquitetura IPC do Lexio — como adicionar features end-to-end entre o processo main (Node.js/SQLite) e o renderer (React/Vite) via contextBridge tipado.
---

# Electron Architecture Skill

## Princípio Central

> O renderer **NUNCA** acessa o filesystem, SQLite, ou APIs Node.js diretamente.  
> Toda comunicação passa pelo `contextBridge` definido no preload.

---

## Arquitetura dos 3 Processos

```
┌─────────────────────────────────────────────────────────┐
│  MAIN PROCESS (Node.js — src/main/)                     │
│  index.ts → ipc.ts → db.ts                              │
│  Acesso total: filesystem, SQLite, APIs nativas         │
├─────────────────────────────────────────────────────────┤
│  PRELOAD (src/preload/index.ts)                         │
│  contextBridge.exposeInMainWorld('lexio', api)          │
│  Ponte tipada com LexioAPI                              │
├─────────────────────────────────────────────────────────┤
│  RENDERER (React — src/renderer/)                       │
│  Acessa apenas window.lexio.*                           │
│  ZERO acesso a Node.js ou filesystem                    │
└─────────────────────────────────────────────────────────┘
```

---

## Como Adicionar uma Nova Feature IPC (End-to-End)

Siga SEMPRE esta sequência de 4 passos:

### PASSO 1 — Tipos (`src/types/index.ts`)

Defina ou estenda a interface `LexioAPI` com o novo método:

```ts
// src/types/index.ts
export interface LexioAPI {
  // ... métodos existentes ...
  getWordStats: () => Promise<WordStats>  // novo método
}

export interface WordStats {
  totalWords: number
  savedWords: number
  mostViewed: string | null
}
```

**Regras:**
- ZERO `any` — defina interfaces explícitas para tudo
- Tipos partilhados aqui são usados pelo main, preload E renderer
- Novos tipos de retorno da DB devem herdar de tipos existentes quando possível

---

### PASSO 2 — Handler no Main (`src/main/ipc.ts`)

```ts
// src/main/ipc.ts
import * as db from './db'

export function registerIpcHandlers(win: BrowserWindow): void {
  // ... handlers existentes ...
  ipcMain.handle('word:stats', () => db.getWordStats())  // novo handler
}
```

**Regras:**
- Nome do canal: sempre `namespace:ação` (ex: `word:get`, `word:save`)
- Lógica de dados NUNCA fica no ipc.ts — delega sempre para db.ts
- Use `ipcMain.handle` para operações que retornam dados (async)
- Use `ipcMain.on` apenas para fire-and-forget (ex: `window:close`)

---

### PASSO 3 — Preload Bridge (`src/preload/index.ts`)

```ts
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import type { LexioAPI } from '../types'

const api: LexioAPI = {
  // ... métodos existentes ...
  getWordStats: () => ipcRenderer.invoke('word:stats'),  // novo método
}

contextBridge.exposeInMainWorld('lexio', api)
```

**Regras:**
- O objeto `api` DEVE implementar 100% da interface `LexioAPI`
- Se `LexioAPI` define o tipo mas api não implementa → erro de TypeScript → ÓTIMO
- Nunca exponha `ipcRenderer` diretamente — apenas métodos encapsulados

---

### PASSO 4 — Hook no Renderer (`src/renderer/hooks/`)

```ts
// src/renderer/hooks/useWordStats.ts
import { useState, useEffect } from 'react'
import type { WordStats } from '../../types'

export function useWordStats() {
  const [stats, setStats] = useState<WordStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.lexio.getWordStats()
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  return { stats, loading }
}
```

**Regras:**
- Hooks ficam em `src/renderer/hooks/`
- Nome sempre `use` + PascalCase descritivo
- Nunca chamar `window.lexio.*` diretamente em componentes — sempre via hook
- Tipagem vem de `../../types` (shared)

---

## Estrutura de Ficheiros

```
src/
├── types/
│   └── index.ts          ← PASSO 1: tipos partilhados + LexioAPI
├── main/
│   ├── index.ts          ← inicialização, BrowserWindow, app lifecycle
│   ├── db.ts             ← TODA lógica SQLite aqui
│   ├── ipc.ts            ← PASSO 2: apenas registra handlers → delega para db.ts
│   ├── shortcut.ts       ← atalho global Ctrl+Shift+E
│   └── tray.ts           ← system tray icon
├── preload/
│   └── index.ts          ← PASSO 3: contextBridge
└── renderer/
    ├── hooks/            ← PASSO 4: lógica de estado/efeitos
    ├── components/       ← componentes React (APENAS renderização)
    └── lib/
        └── claude.ts     ← wrapper Claude API (única exceção: fetch externo no renderer)
```

---

## ❌ Proibido

```ts
// ❌ ERRADO — renderer acessando Node.js diretamente
import fs from 'fs'
import Database from 'better-sqlite3'

// ❌ ERRADO — lógica de negócio em componente
function WordCard() {
  const handleSave = async () => {
    await window.lexio.saveWord(data)  // deveria estar em um hook
  }
}

// ❌ ERRADO — any
ipcMain.handle('word:get', (_, word: any) => db.getWord(word))

// ❌ ERRADO — lógica SQL no ipc.ts
ipcMain.handle('word:stats', () => {
  return db.prepare('SELECT COUNT(*) FROM words').get()  // isso vai em db.ts
})
```

---

## ✅ Correto

```ts
// ✅ CERTO — renderer só conhece window.lexio
const word = await window.lexio.getWord('churn')

// ✅ CERTO — hook encapsula chamadas IPC
const { word, loading } = useSearch()

// ✅ CERTO — db.ts centraliza todas as queries
export function getWordStats(): WordStats {
  const total = db.prepare('SELECT COUNT(*) as count FROM words').get() as { count: number }
  return { totalWords: total.count, ... }
}
```

---

## Checklist de Validação

Antes de submeter qualquer feature IPC:

- [ ] Tipo adicionado/atualizado em `src/types/index.ts`
- [ ] Handler registrado em `src/main/ipc.ts` com canal `namespace:ação`
- [ ] Lógica SQL implementada em `src/main/db.ts` (não no ipc.ts)
- [ ] Método adicionado ao objeto `api` no preload
- [ ] TypeScript: preload implementa `LexioAPI` 100% (sem erros de tipo)
- [ ] Hook criado em `src/renderer/hooks/`
- [ ] Zero `any` em todos os ficheiros tocados

---

## Priority Level: CRITICAL

Esta arquitetura é inviolável. Qualquer desvio compromete a segurança e a manutenção do app.
