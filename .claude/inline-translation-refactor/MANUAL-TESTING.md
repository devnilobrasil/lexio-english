# Manual Testing — Lexio Mode Tabs (unified window)

**Branch:** `feat/unify-mode-tabs`  
**Atalhos:**

| Atalho | Função |
|---|---|
| `Ctrl+Alt+E` | Toggle show/hide da janela principal (mantém a aba atual) |
| `Ctrl+Alt+T` | Captura seleção, foca a main e abre a aba **Traduzir** |

---

## Pré-requisitos

1. Worktree: `.worktrees/feat-unify-mode-tabs`
2. `npm run dev` (Tauri)
3. Chave API configurada em Configurações (Gemini/Groq) **ou** Ollama local
4. Notepad (ou app com TextPattern UIA)

---

## Checklist

### Titlebar
- [ ] Uma linha: Logo | Dicionário | Traduzir | … | ações | min/close
- [ ] Logo sem clique (só marca)
- [ ] Em Dicionário: ícone expand/recolher + LocaleSelect
- [ ] Em Traduzir: Copiar (quando ready) + Info; sem LocaleSelect
- [ ] SearchBar (Dicionário) ocupa toda a largura (só input)

### Abas / resize
- [ ] Idle (~110px) mostra titlebar + SearchBar
- [ ] Trocar para Traduzir redimensiona (~320px)
- [ ] Voltar a Dicionário restaura idle ou result conforme estado

### Happy path (Traduzir)
- [ ] Selecionar texto em **português** no Notepad
- [ ] Premir `Ctrl+Alt+T`
- [ ] Main foca na aba Traduzir (sem segunda janela)
- [ ] Mostra loading → tradução no corpo (sem header interno)
- [ ] Ícone Copiar na titlebar (azul) copia e muda para check ~2s
- [ ] ESC limpa o painel (não esconde a app)
- [ ] Ícone info na titlebar mostra texto sobre cobertura UIA

### Sem seleção / inglês
- [ ] Sem seleção → mensagem para selecionar texto
- [ ] Inglês longo → mensagem de texto em inglês

### Dicionário isolado
- [ ] Buscar uma palavra na aba Dicionário
- [ ] `Ctrl+Alt+T` muda para Traduzir
- [ ] Voltar a Dicionário mantém o resultado da busca
- [ ] Ícone expand/recolher alterna idle ↔ result

### Tray
- [ ] Menu do tray: Show Lexio + Quit (sem Show Assistant)

### O que NÃO deve existir
- [ ] Sem janela `assistant` separada
- [ ] Sem `overlay.html` / bubble
- [ ] Sem barra interna “Tradução” / X no painel
