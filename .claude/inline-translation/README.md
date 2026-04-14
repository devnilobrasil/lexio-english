# Lexio — Inline Translation Suggestion

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `SPEC.md` | Especificação técnica completa (arquivo-mãe) |
| `fase-1-backend-deteccao.md` | Detecção global de seleção + gate de idioma (`rdev`, `lang_detect`, `selection_watcher`) |
| `fase-2-frontend-dialog.md` | Componente `SuggestionDialog` isolado + CSS de expansão + variante `available` no `FloatingButton` |
| `fase-3-backend-commands.md` | Commands Tauri: `suggestion_request`, `suggestion_accept`, `suggestion_dismiss` |
| `fase-4-integracao.md` | Hook `useInlineSuggestion` + integração end-to-end + testes E2E |
| `fase-5-polish.md` | Timeouts, animação, clique-fora, mensagens de erro, aviso de segurança, checklist de merge |

## Ordem de Execução

Fases devem ser executadas em sequência: 1 → 2 → 3 → 4 → 5.
Cada fase tem um **critério de saída** — não avançar sem que esteja satisfeito.

| Fase | Modelo | Descrição |
|---|---|---|
| Fase 1 | `claude-opus-4-6` | Backend: `rdev` + `lang_detect` + `selection_watcher` + limpeza do shortcut antigo |
| Fase 2 | `claude-sonnet-4-6` | Frontend: `SuggestionDialog.tsx` + CSS + variante `available` |
| Fase 3 | `claude-opus-4-6` | Backend: commands de suggestion com async Rust correto (sem MutexGuard através de await) |
| Fase 4 | `claude-opus-4-6` | Integração: `useInlineSuggestion.ts` + resize de janela + testes Vitest e E2E |
| Fase 5 | `claude-sonnet-4-6` | Polish: timeouts, animação, clique-fora, erros amigáveis, checklist de merge |

## Princípio Central

Substituir o overlay de tradução ativo (shortcut `Ctrl+Alt+Shift+T`) por uma sugestão passiva estilo Grammarly: detecção automática de seleção → ícone próximo ao texto → diálogo com aceitar/rejeitar. Primeira feature de uma família extensível (rephrase, improve, tone). O custo de API é **zero** até o usuário clicar no bubble.

## Dependências Rust novas

```toml
rdev = "0.5"
```

## Tipos TypeScript novos

```typescript
type InlineSuggestionState = "idle" | "available" | "loading" | "ready" | "error"
interface TextSelectedPayload { text: string; x: number; y: number }
interface SuggestionResponse { original: string; translation: string }
```
