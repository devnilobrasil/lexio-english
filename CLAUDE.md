# CLAUDE.md — Lexio

> Arquivo de contexto do projeto para Claude Code.  
> Leia este arquivo inteiro antes de qualquer tarefa.

---

## Projeto

**Lexio** é um app desktop de aprendizado de inglês. O aluno busca palavras em inglês e recebe significado, fonética, exemplos e sinônimos gerados pela Claude API. As palavras são cacheadas localmente em SQLite.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Shell | Electron v33+ (frameless, system tray, atalho global) |
| UI | React 18 + Vite + TypeScript |
| Estilos | Tailwind CSS v4 + CSS customizado |
| Banco | `better-sqlite3` (síncrono, arquivo local) |
| IA | Claude API (`claude-sonnet-4-20250514`) |
| IPC | Electron `contextBridge` com `LexioAPI` tipada |

**Não é Next.js. Não usa Supabase. Não usa shadcn/ui. É offline-first.**

---

## Arquitetura — 3 Processos

```
MAIN  (Node.js) — src/main/
  ├── index.ts     app lifecycle, BrowserWindow
  ├── db.ts        TODA lógica SQLite (better-sqlite3, síncrono)
  ├── ipc.ts       registra handlers → delega para db.ts
  ├── shortcut.ts  Ctrl+Shift+E — toggle visibilidade
  └── tray.ts      system tray icon

PRELOAD — src/preload/index.ts
  └── contextBridge.exposeInMainWorld('lexio', api: LexioAPI)

RENDERER (React/Vite) — src/renderer/
  ├── hooks/       lógica de estado, chamadas a window.lexio.*
  ├── components/  APENAS renderização, zero lógica de negócio
  └── lib/
      └── claude.ts   único fetch externo permitido no renderer
```

**Regra de ouro:** O renderer NUNCA acessa Node.js, filesystem ou SQLite diretamente. Tudo via `window.lexio.*`.

---

## Regras de Código

- **TypeScript strict** — zero `any`. Interfaces explícitas para tudo.
- **Arquivo .ts/.tsx** — máx. 150 linhas. Se passar, quebrar em módulos.
- **Hooks** — toda chamada a `window.lexio.*` fica em `src/renderer/hooks/`
- **DB** — toda query SQL fica em `src/main/db.ts`. Nunca em `ipc.ts`.
- **Serialização** — `better-sqlite3` é síncrono. Arrays (`examples`, `synonyms`, `contexts`) são guardados como JSON string e precisam de `serialize()`/`deserialize()`.

---

## Design System

Visual editorial (dicionário), não tecnológico (dashboard).

- **Tipografia:** Lora (serif) para conteúdo lexicográfico, Inter (sans) para chrome do app
- **Cores:** Paleta quente de off-whites. Azul APENAS para contextos semânticos.
- **Proibido:** `box-shadow`, gradientes, `border-radius > 8px`, `font-weight > 600`
- **Referência completa:** `LEXIO_DESIGN_SYSTEM.md`

---

## Skills Disponíveis

Leia as skills relevantes ANTES de implementar qualquer feature:

| Skill | Quando usar |
|---|---|
| `.gemini/skills/electron-architecture/SKILL.md` | Qualquer feature com IPC (main ↔ renderer) |
| `.gemini/skills/lexio-design-system/SKILL.md` | Qualquer mudança de UI/CSS |
| `.gemini/skills/sqlite-patterns/SKILL.md` | Queries, schema, novos campos no DB |
| `.gemini/skills/claude-api-patterns/SKILL.md` | Modificar prompt, parsing, novos campos da API |
| `.gemini/skills/git-workflow/SKILL.md` | Commits, branches, PRs |
| `.gemini/skills/electron-build-deploy/SKILL.md` | Build, distribuição, releases |
| `.gemini/skills/lexio-testing/SKILL.md` | Testes E2E com Playwright |
| `.gemini/skills/mcp-tooling/SKILL.md` | Configuração de MCP tools |

---

## Git Workflow

```
Branch: feat/|fix/|refactor/|docs/|test/|chore/ + descrição
Commit: type: descrição em imperativo (máx 72 chars)
Base:   stage (NUNCA commitar diretamente em main)
PR:     sempre abrir PR para stage
```

---

## Fluxo de Busca de Palavra

```
[renderer] hook useSearch
  → window.lexio.getWord("churn")   → Main → SQLite
    Se encontrou no DB: retorna imediatamente (sem custo de API)
    Se não encontrou:
      → fetchWordFromClaude("churn") → Claude API
      → window.lexio.saveWord(resultado) → Main → SQLite upsert
      → retorna Word completo
```

---

## Checklist Universal (antes de qualquer commit)

- [ ] Leu a skill relevante antes de implementar
- [ ] Zero `any` no TypeScript
- [ ] Zero SQL fora de `src/main/db.ts`
- [ ] Zero chamadas `window.lexio.*` fora de hooks
- [ ] UI segue tokens do design system (sem cores hardcoded)
- [ ] `npm run build:renderer` passa sem erros
- [ ] Branch criada, commit convencional, PR para `stage`
