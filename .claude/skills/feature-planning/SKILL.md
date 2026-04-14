---
name: feature-planning
description: Use when planning a new feature from scratch — from user intent to implementable phase documents. Covers the full planning lifecycle: brainstorming, SPEC.md, phase files, README, and skill creation. Applies to any non-trivial feature in the Lexio project.
---

# Feature Planning

## Visão geral

Toda feature não-trivial no Lexio passa por 3 artefatos antes de qualquer código ser escrito:

1. **`SPEC.md`** — Especificação técnica completa (o que, por que, contratos IPC, riscos).
2. **Arquivos de fase** (`fase-N-*.md`) — Planos de execução sequenciais, cada um autocontido.
3. **`README.md`** — Índice da pasta com tabela de arquivos e ordem de execução.

Os artefatos vivem em `.claude/<nome-da-feature>/`. Exemplo: `.claude/inline-translation/`.

---

## Quando usar esta skill

- Usuário pede uma feature nova ou refactor significativo
- A feature envolve múltiplos arquivos, múltiplas camadas (Rust + React), ou decisões de arquitetura
- A feature é a "primeira de várias" (tem extensibilidade como requisito)
- Você não sabe ao certo o que o usuário quer — a fase de brainstorming vai revelar

**Não usar** para: bugfixes de 1 arquivo, mudanças de CSS isoladas, renomeações.

---

## Ferramentas e Plugins necessários

| Ferramenta | Para que serve |
|---|---|
| **Claude Code (claude.ai/code ou CLI)** | Ambiente de execução |
| **Superpowers plugin** (v5.0.7+) | Acesso a todas as skills abaixo |
| **GitHub MCP** | Criar PR automaticamente após merge |
| **Modelo Opus 4.6** | Fases com Rust complexo, IPC, concorrência |
| **Modelo Sonnet 4.6** | Brainstorming, SPEC.md, fases de CSS/React simples |

---

## Processo completo (passo a passo)

### Fase A — Brainstorming (antes de qualquer artefato)

**Ler e seguir:** `superpowers:brainstorming`

**Modelo:** `claude-sonnet-4-6` (fase criativa, não precisa de Opus)

Objetivos:
- Entender a intenção real do usuário (não o que ele pediu, mas por quê)
- Identificar constraints técnicos que afetam o design antes de comprometer
- Decidir escopo explícito (o que está FORA é tão importante quanto o que está DENTRO)
- Validar extensibilidade se a feature é "a primeira de várias"

**Perguntas críticas a fazer:**
1. Qual o escopo de abrangência? (sistema inteiro vs. só dentro do app vs. híbrido)
2. O que dispara a ação? (usuário explícito vs. detecção passiva)
3. Qual a direção/sentido da transformação?
4. Esta feature precisa ser extensível para N variantes futuras?

> **Regra:** não começar o SPEC antes de o usuário responder às perguntas de escopo. Uma decisão de escopo errada invalida o spec inteiro.

---

### Fase B — Exploração do código existente

**Usar:** Agente `Explore` (subagent_type: "Explore") com thoroughness "medium"

**Modelo:** Haiku 4.5 (exploração é barata)

Objetivos:
- Mapear arquivos que serão criados vs. modificados
- Identificar funções existentes que podem ser **reaproveitadas** (nunca reescrever o que já existe)
- Entender o formato de spec/fase existente se houver referência (ler `.claude/tauri-migration/` como modelo)

**O que documentar:**
- Caminhos exatos de arquivos relevantes com números de linha
- Funções reutilizáveis com assinaturas
- Estrutura de pastas do projeto pós-migração (pode ter mudado desde o CLAUDE.md)

---

### Fase C — Escrever o `SPEC.md`

**Estar em:** Plan Mode (EnterPlanMode antes de escrever)

**Modelo:** `claude-opus-4-6` (spec é o artefato mais importante, requer raciocínio profundo)

**Local:** `.claude/<nome-da-feature>/SPEC.md`

**Convenção de nome da pasta:**
- Hifenizado, lowercase, descritivo: `inline-translation`, `inline-rephrase`, `tauri-migration`
- Se é uma família de features, nomear pela feature específica (não pelo padrão genérico)
- Exemplo errado: `passive-suggestions/` — muito genérico
- Exemplo correto: `inline-translation/` — específico, extensível com irmãos

**Estrutura obrigatória do SPEC.md** (baseada em `.claude/tauri-migration/SPEC.md`):

```
# Lexio — Especificação: <Nome da Feature>

Objetivo (1 parágrafo)

---

## 1. Contexto e objetivo
   ### Problema atual
   ### Visão da nova feature
   ### Escopo explícito (no escopo / fora do escopo)

## 2. O que muda e o que não muda
   ### Muda (tabela: aspecto | atual | novo)
   ### Não muda (lista)

## 3. UX Flow completo
   - Diagrama de estados (ASCII)
   - Fluxo numerado passo a passo
   - Diagrama ASCII do UI principal

## 4. Arquitetura (janelas, state, decisões)
   - Decisão tomada e justificativa
   - Tradeoffs considerados e rejeitados
   - State em memória (structs Rust se aplicável)

## 5. Implementação — módulo principal (ex: detecção, IPC, etc.)
   - Pseudocódigo ou código de referência
   - Constantes e heurísticas
   - Problema explícito e aceito (limitações conhecidas)
   - Alternativa futura (fora do MVP)

## 6. Módulo secundário (ex: detecção de idioma, AI client)

## 7. Contrato IPC (commands + events)
   - Commands novos (assinaturas Rust)
   - Tipos compartilhados (Rust + TS)
   - Events (tabela: evento | payload | quando)
   - Commands/shortcuts removidos

## 8. Frontend — React
   ### Arquivos a criar (com interfaces TS)
   ### Arquivos a modificar
   ### Tipos TS

## 9. Backend Rust — arquivos
   ### Criar (tabela: arquivo | responsabilidade)
   ### Modificar (tabela: arquivo | alteração)

## 10. Estratégia de preservação/segurança (clipboard, dados sensíveis)

## 11. Estratégia de testes
   ### Rust unit tests (com exemplos de casos)
   ### Frontend Vitest
   ### E2E Playwright

## 12. Fases de execução (sumário)
   Fase 1 — <nome>: lista de ítens
   Fase 2 — <nome>: lista de ítens
   ...

## 13. Extensibilidade para features futuras
   - O que é reutilizável sem modificação
   - O que precisará mudar quando existir a segunda feature

## 14. Riscos e tradeoffs
   Tabela: risco | impacto | mitigação

## 15. Checklist de pronto-para-merge
   Lista completa com checkboxes
```

**Regras de estilo do SPEC:**
- Idioma: **Português** (convenção do projeto)
- Tabelas para mapeamentos (atual vs. novo)
- Blocos de código Rust e TypeScript para contratos IPC
- Seção de riscos **sempre inclui** segurança (campos de password, API keys, etc.)
- Tamanho alvo: 300–500 linhas
- Após escrever, apresentar ao usuário e pedir feedback antes de criar as fases

---

### Fase D — Criar os arquivos de fase

**Modelo por fase:**

| Tipo de fase | Modelo recomendado | Por quê |
|---|---|---|
| Fase com Rust complexo (async, MutexGuard, threads, rdev) | `claude-opus-4-6` | Requer raciocínio profundo sobre concorrência e lifetimes |
| Fase de frontend React/CSS | `claude-sonnet-4-6` | Lógica simples, sem concorrência |
| Fase de integração (conectar tudo) | `claude-opus-4-6` | Race conditions e timing entre camadas |
| Fase de polish e edge cases | `claude-sonnet-4-6` | Iterativo, sem novidade técnica |
| Fase de scaffolding/configuração | `claude-sonnet-4-6` | JSON/TOML, sem lógica |

**Local:** `.claude/<nome-da-feature>/fase-N-<descricao>.md`

**Convenção de nome:** `fase-1-backend-deteccao.md`, `fase-2-frontend-dialog.md` (número + camada + descrição)

**Estrutura obrigatória de cada arquivo de fase:**

```markdown
# Fase N — <Título>

**Objetivo:** <1 frase clara do que será construído e do estado ao final>

**Referência:** `SPEC.md` — Seções X, Y, Z

---

## Skills e Modelo

**Modelo recomendado:** `claude-<model>`
<Justificativa da escolha do modelo>

**Ler antes de implementar:**
| Skill | Por quê |
|---|---|
| `.claude/skills/<skill>/SKILL.md` | <razão específica> |
| `superpowers:<skill>` | <razão específica> |

---

## Pré-requisitos
- Fase anterior concluída (critérios de saída verificados)
- Comandos de verificação de baseline

---

## Estrutura de Arquivos desta Fase
```
arquivos/
├── novo.rs    ← NOVO
└── existente  ← MODIFICAR: o que muda
```

---

## Passo N — <Nome do passo>
<Código concreto, não pseudocódigo vago>

---

## Verificação da Fase N
```bash
comandos de verificação
```

### Checklist de saída
- [ ] Item verificável
- [ ] Teste manual: ação → resultado esperado

---

## Arquivos Criados nesta Fase
## Arquivos Modificados nesta Fase
```

**Regras por arquivo de fase:**
- Código **concreto** — não pseudocódigo quando possível. O implementador deve poder copiar e colar.
- Testes escritos **antes** da implementação (TDD — ver `superpowers:test-driven-development`)
- Cada fase tem um **critério de saída claro** — testes automatizados + checklist manual
- A Fase 1 **sempre** limpa o código obsoleto antes de criar o novo
- A Fase final **sempre** aponta para `superpowers:finishing-a-development-branch`
- **Nunca** mencionar a Fase seguinte dentro de uma fase — cada fase é autocontida

**Número de fases:** entre 3 e 6. Mais de 6 indica que a feature está grande demais (dividir em specs separados).

**Skills sempre presentes no cabeçalho de toda fase:**

| Se a fase toca | Incluir skill |
|---|---|
| Qualquer IPC Tauri | `tauri-architecture` |
| Qualquer CSS ou JSX | `lexio-design-system` |
| Qualquer SQL ou SQLite | `sqlite-patterns` |
| Qualquer código Rust | `rust-patterns` |
| Fase de integração | `superpowers:systematic-debugging` |
| Fase final | `superpowers:finishing-a-development-branch` |
| Branch nova | `superpowers:using-git-worktrees` |

---

### Fase E — Criar o `README.md`

**Modelo:** `claude-sonnet-4-6`

**Local:** `.claude/<nome-da-feature>/README.md`

**Estrutura:**

```markdown
# Lexio — <Nome da Feature>

## Arquivos
| Arquivo | Conteúdo |
|---|---|
| `SPEC.md` | Especificação técnica completa (arquivo-mãe) |
| `fase-N-*.md` | Descrição em 1 linha |

## Ordem de Execução
Fases devem ser executadas em sequência: 1 → 2 → ... → N.
Cada fase tem um **critério de saída** — não avançar sem que esteja satisfeito.

| Fase | Modelo | Descrição |
|---|---|---|
| Fase 1 | `claude-opus-4-6` | ... |

## Princípio Central
<1-2 frases explicando o propósito da feature>

## Dependências novas (se houver)
<crates Rust, pacotes npm>

## Tipos TS novos (se houver)
<interfaces/tipos adicionados>
```

---

### Fase F — Criar a skill (opcional)

Criar uma skill apenas se o padrão de planejamento for reutilizável para outros desenvolvedores do projeto.

**Ler e seguir:** `superpowers:writing-skills`

**Local:** `.claude/skills/<nome>/SKILL.md`

**Frontmatter obrigatório:**

```yaml
---
name: nome-da-skill
description: Use when <trigger claro>. Covers <o que cobre>. Applies to <escopo>.
---
```

---

## Checklist de qualidade antes de entregar os artefatos

### SPEC.md
- [ ] Tem seção de escopo explícito (no escopo / fora do escopo)
- [ ] Tem tabela de riscos com coluna de mitigação
- [ ] Menciona segurança (campos de password, API keys, clipboard)
- [ ] Tem checklist de merge na seção final
- [ ] Idioma: Português
- [ ] Tamanho: 300–500 linhas

### Arquivos de fase
- [ ] Cada fase tem modelo recomendado com justificativa
- [ ] Cada fase tem tabela de skills a ler antes de implementar
- [ ] Cada fase tem critério de saída com checklist
- [ ] Código concreto (não só pseudocódigo)
- [ ] Fase 1 limpa código obsoleto
- [ ] Fase final aponta para `finishing-a-development-branch`
- [ ] TDD: testes aparecem antes da implementação em cada fase

### README.md
- [ ] Tabela de todos os arquivos
- [ ] Tabela de fases com modelo recomendado
- [ ] Princípio central em 1-2 frases
- [ ] Dependências novas listadas

---

## Referências

| Recurso | Caminho |
|---|---|
| Exemplo de SPEC completo | `.claude/tauri-migration/SPEC.md` |
| Exemplo de fase completa | `.claude/tauri-migration/fase-5-overlay-translation.md` |
| Exemplo de README de feature | `.claude/inline-translation/README.md` |
| Design system | `LEXIO_DESIGN_SYSTEM.md` |
| Skill de IPC Tauri | `.claude/skills/tauri-architecture/SKILL.md` |
| Skill de Rust | `.claude/skills/rust-patterns/SKILL.md` |
| Skill de testes E2E | `.claude/skills/lexio-testing/SKILL.md` |
| Skill de build/release | `.claude/skills/tauri-build-deploy/SKILL.md` |
| Brainstorming | `superpowers:brainstorming` |
| Escrita de planos | `superpowers:writing-plans` |
| TDD | `superpowers:test-driven-development` |
| Worktrees | `superpowers:using-git-worktrees` |
| Finalização de branch | `superpowers:finishing-a-development-branch` |
| Debugging | `superpowers:systematic-debugging` |
| Writing skills | `superpowers:writing-skills` |

---

## Anti-padrões a evitar

| Anti-padrão | Correto |
|---|---|
| Escrever código antes de ter o SPEC aprovado | SPEC → aprovação → fases |
| Fase com pseudocódigo vago ("implementar X") | Código concreto com imports, assinaturas e lógica |
| Misturar Rust e React na mesma fase | Uma fase por camada |
| SPEC sem seção de riscos | Sempre incluir riscos, mesmo que o impacto seja baixo |
| Escolher Sonnet para fase com Rust async | Usar Opus para qualquer fase com MutexGuard/lifetimes/threads |
| Não referenciar skills no cabeçalho de cada fase | Sempre listar skills relevantes — o implementador não vai lembrar |
| Criar spec genérico ("passive-suggestions") para feature específica | Nome específico + extensível via pastas irmãs |
| Começar implementação sem worktree | Sempre criar branch isolada via `superpowers:using-git-worktrees` |
