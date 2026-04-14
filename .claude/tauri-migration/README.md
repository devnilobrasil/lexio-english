# Lexio — Migração Electron → Tauri v2

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `SPEC.md` | Especificação técnica completa (arquivo-mãe) |
| `fase-1-scaffolding.md` | Criar projeto Tauri, configurar janelas, ajustar Vite |
| `fase-2-db-settings.md` | Backend Rust: rusqlite, schema, migrations, todos os commands de DB |
| `fase-3-groq-api.md` | AI Client (Gemini) em Rust, deletar `ai.ts` (GROQ [deprecated]), simplificar `useSearch` |
| `fase-4-windows-shortcuts-tray.md` | Commands de janela, atalhos globais, system tray |
| `fase-5-overlay-translation.md` | Tradução via Ctrl+Alt+T, enigo + arboard, estado do overlay |
| `fase-6-updater-tests.md` | Auto-updater, testes Vitest com mockIPC, build de produção |

## Ordem de Execução

Fases devem ser executadas em sequência: 1 → 2 → 3 → 4 → 5 → 6.
Cada fase tem um **critério de saída** — não avançar sem que esteja satisfeito.

## Princípio Central

Paridade funcional completa. O app Tauri deve se comportar identicamente ao app Electron atual. Nenhuma funcionalidade nova. Nenhuma funcionalidade removida.
