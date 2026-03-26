---
trigger: always_on
---

# Project Rules: Lexio

## Project Context

**Project Name:** Lexio (App desktop de aprendizado de inglês)
**Stack:** Electron v33+, React 18, TypeScript, Vite, Tailwind CSS v4, better-sqlite3, Claude API
**Target Branch:** stage (NEVER commit directly to main/production)

---

## Core Principles

1. **Electron Security** - O renderer NUNCA acessa Node.js, filesystem ou SQLite diretamente. Toda comunicação via `window.lexio.*` (contextBridge).
2. **TypeScript Strict** - Proibido o uso de `any`. Interfaces explícitas para tipos de IPC, DB e API.
3. **Design System** - UI segue `LEXIO_DESIGN_SYSTEM.md`. Sem sombras, sem gradientes, tipografia Lora/Inter.
4. **Git Workflow Mandatory** - Branch → Build → Commit → PR para `stage`.
5. **Continuous Learning** - OBRIGATÓRIO ler `.gemini/rules/lessons_learned.md` antes de iniciar qualquer tarefa.

---

## Skills Reference

- **electron-architecture** - Padrão IPC end-to-end: types → ipc.ts → preload → hook. Leia ao adicionar qualquer feature com comunicação main/renderer.
- **lexio-design-system** - Tokens de cor, tipografia (Lora/Inter), regras visuais. Leia antes de qualquer mudança de UI.
- **sqlite-patterns** - Queries, serialize/deserialize de JSON, schema migrations. Leia ao tocar no banco.
- **claude-api-patterns** - Wrapper, system prompt, parsing seguro, cache. Leia ao modificar `lib/claude.ts`.
- **git-workflow** - Branches convencionais, commits, PRs para `stage`.
- **electron-build-deploy** - Sequência de build, `electron-rebuild`, targets por OS.
- **lexio-testing** - E2E com Playwright + Electron, mock da Claude API.
- **mcp-tooling** - Configuração de MCP tools (GitHub, DB Inspector).

---

## Project-Specific Configurations

### GitHub
- Repository: `devnilobrasil/lexio`
- Base Branch: `stage`

---

## Team Standards

### Code Review Criteria
- [ ] Zero `any` no TypeScript.
- [ ] SQL apenas em `src/main/db.ts` (nunca em ipc.ts ou no renderer).
- [ ] Campos JSON do SQLite passando por `serialize()`/`deserialize()`.
- [ ] Chamadas `window.lexio.*` encapsuladas em hooks (nunca em componentes).
- [ ] UI sem `box-shadow`, sem gradientes, sem cores hardcoded inline.
- [ ] Build do renderer passa sem erros (`npm run build:renderer`).

---
## Getting Help
- **Lessons Learned:** Ver `.gemini/rules/lessons_learned.md` para evitar erros conhecidos.

---

## Priority Enforcement
1. **Security** - Nunca expor chaves de serviço.

**END OF RULES**
