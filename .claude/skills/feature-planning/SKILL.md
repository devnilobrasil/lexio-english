---
name: feature-planning
description: Use when planning a new feature from scratch — from user intent to implementable task documents. Covers the full planning lifecycle: brainstorming, SPEC.md, TASK-MANAGER.md, task files, README, and skill creation. Applies to any non-trivial feature in the Lexio project.
---

# Feature Planning

## Visão geral

Toda feature não-trivial no Lexio produz os seguintes artefatos:

**Planejamento** (criados antes de qualquer código):

1. **`SPEC.md`** — Especificação técnica completa (o que, por que, contratos IPC, riscos).
2. **`TASK-MANAGER.md`** — Plano de execução e breakdown de todas as tasks.
3. **Arquivos de task** (`task-TN-*.md`) — Detalhamento sequencial de cada task, cada um autocontido.
4. **`README.md`** — Índice da pasta com tabela de arquivos e ordem de execução.

**Execução** (criado antes de T0, atualizado continuamente):

5. **`PROGRESS.md`** — Log de progresso da implementação: status por task, o que funcionou, dificuldades, desvios e contexto para novas sessões retomarem de onde pararam.

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
| **Modelo Opus 4.6** | Tasks com Rust complexo, IPC, concorrência |
| **Modelo Sonnet 4.6** | Brainstorming, SPEC.md, tasks de CSS/React simples |

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

## 12. Tasks de execução (sumário)
   T0 — <nome>: lista de ítens
   T1 — <nome>: lista de ítens
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
- Após escrever, apresentar ao usuário e pedir feedback antes de criar as tasks

---

### Fase D — Criar os artefatos de implementação

Após a aprovação do SPEC.md, o próximo passo é criar o **Task Manager** e os **arquivos de task** que guiarão a implementação.

#### D1 — Criar o `TASK-MANAGER.md`

**Modelo:** `claude-sonnet-4-6`

**Local:** `.claude/<nome-da-feature>/TASK-MANAGER.md`

O Task Manager é o documento central de referência para implementação. Reúne todas as tasks de forma concisa, define o plano de execução (sequencial/paralelo) e o detalhamento resumido de cada task.

**Estrutura obrigatória do TASK-MANAGER.md:**

````markdown
# Task Manager — <Nome da Feature>

## Plano de Execução

Sequência de execução das tasks. Tasks dentro da mesma fase de execução podem ser feitas em paralelo.

| Fase de Execução | Tasks | Descrição |
|---|---|---|
| Fase 0 | T0, T1 | <Descrição breve do que essas tasks entregam juntas> |
| Fase 1 | T2, T3, T4 | <Descrição breve> |
| Fase 2 | T5 | <Descrição breve> |

---

## Task Breakdown

### T0 — <Nome da Task>

| Campo | Detalhe |
|---|---|
| **What** | O que esta task faz (1 frase clara) |
| **Where** | Arquivos/módulos onde será implementada |
| **Dependências** | Tasks que precisam estar concluídas antes (ou "—" se nenhuma) |
| **Reuses** | Código/funções existentes que serão reaproveitadas (ou "—") |
| **Requisitos** | O que deve ser implementado nesta task |
| **Pré-requisitos** | Condições de ambiente/estado que precisam existir |
| **Done when** | Critério objetivo e verificável de conclusão |

### T1 — <Nome da Task>

| Campo | Detalhe |
|---|---|
| **What** | ... |
| **Where** | ... |
| **Dependências** | T0 |
| **Reuses** | ... |
| **Requisitos** | ... |
| **Pré-requisitos** | ... |
| **Done when** | ... |
````

**Regras do TASK-MANAGER.md:**
- Uma task por responsabilidade — não agrupar Rust + React na mesma task
- "Done when" deve ser verificável (teste automatizado ou ação manual mensurável)
- Dependências explícitas evitam bloqueios de implementação
- Reuses devem listar caminhos exatos e assinaturas de funções quando possível
- Número de tasks: entre 3 e 8. Mais de 8 indica que a feature está grande demais (dividir em specs separados)

---

#### D2 — Criar os arquivos de task

**Modelo por task:**

| Tipo de task | Modelo recomendado | Por quê |
|---|---|---|
| Task com Rust complexo (async, MutexGuard, threads, rdev) | `claude-opus-4-6` | Requer raciocínio profundo sobre concorrência e lifetimes |
| Task de frontend React/CSS | `claude-sonnet-4-6` | Lógica simples, sem concorrência |
| Task de integração (conectar tudo) | `claude-opus-4-6` | Race conditions e timing entre camadas |
| Task de polish e edge cases | `claude-sonnet-4-6` | Iterativo, sem novidade técnica |
| Task de scaffolding/configuração | `claude-sonnet-4-6` | JSON/TOML, sem lógica |

**Local:** `.claude/<nome-da-feature>/task-TN-<descricao>.md`

**Convenção de nome:** `task-T0-backend-detection.md`, `task-T1-frontend-dialog.md` (código T + número + camada + descrição)

**Estrutura obrigatória de cada arquivo de task:**

````markdown
# T<N> — <Título>

**Objetivo:** <1 frase clara do que será construído e do estado ao final>

**Referência:** `SPEC.md` — Seções X, Y, Z | `TASK-MANAGER.md` — T<N>

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
- Tasks dependentes concluídas (verificar TASK-MANAGER.md)
- Comandos de verificação de baseline

---

## Estrutura de Arquivos desta Task

```
arquivos/
├── novo.rs    ← NOVO
└── existente  ← MODIFICAR: o que muda
```

---

## Passo N — <Nome do passo>
<Código concreto, não pseudocódigo vago>

---

## Verificação

```bash
comandos de verificação
```

### Checklist de saída
- [ ] Item verificável
- [ ] Teste manual: ação → resultado esperado

---

## Arquivos Criados nesta Task
## Arquivos Modificados nesta Task
````

**Regras por arquivo de task:**
- Código **concreto** — não pseudocódigo quando possível. O implementador deve poder copiar e colar.
- Testes escritos **antes** da implementação (TDD — ver `superpowers:test-driven-development`)
- Cada task tem um **critério de saída claro** — testes automatizados + checklist manual
- A T0 **sempre** limpa o código obsoleto antes de criar o novo
- A task final **sempre** aponta para `superpowers:finishing-a-development-branch`
- **Nunca** mencionar a task seguinte dentro de uma task — cada task é autocontida

**Skills sempre presentes no cabeçalho de toda task:**

| Se a task toca | Incluir skill |
|---|---|
| Qualquer IPC Tauri | `tauri-architecture` |
| Qualquer CSS ou JSX | `lexio-design-system` |
| Qualquer SQL ou SQLite | `sqlite-patterns` |
| Qualquer código Rust | `rust-patterns` |
| Task de integração | `superpowers:systematic-debugging` |
| Task final | `superpowers:finishing-a-development-branch` |
| Branch nova | `superpowers:using-git-worktrees` |

---

### Fase E — Criar o `README.md`

**Modelo:** `claude-sonnet-4-6`

**Local:** `.claude/<nome-da-feature>/README.md`

**Estrutura:**

````markdown
# Lexio — <Nome da Feature>

## Arquivos
| Arquivo | Conteúdo |
|---|---|
| `SPEC.md` | Especificação técnica completa (arquivo-mãe) |
| `TASK-MANAGER.md` | Plano de execução e breakdown de todas as tasks |
| `task-TN-*.md` | Descrição em 1 linha por task |
| `PROGRESS.md` | Log de progresso da implementação (atualizado a cada task) |

## Ordem de Execução
Seguir o Plano de Execução definido em `TASK-MANAGER.md`.
Cada task tem um **critério de saída (Done when)** — não avançar sem que esteja satisfeito.

| Task | Modelo | Descrição |
|---|---|---|
| T0 | `claude-opus-4-6` | ... |
| T1 | `claude-sonnet-4-6` | ... |

## Princípio Central
<1-2 frases explicando o propósito da feature>

## Dependências novas (se houver)
<crates Rust, pacotes npm>

## Tipos TS novos (se houver)
<interfaces/tipos adicionados>
````

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

### Fase G — Criar o `PROGRESS.md` (antes de iniciar T0)

> Este é um artefato de **execução**, não de planejamento. É criado imediatamente antes de começar a primeira task e atualizado ao final de cada task concluída.

**Modelo:** `claude-sonnet-4-6`

**Local:** `.claude/<nome-da-feature>/PROGRESS.md`

**Propósito:** Permitir que qualquer nova sessão do Claude Code entenda exatamente onde a implementação está, o que foi feito, o que deu errado, e o que precisa ser feito a seguir — sem depender do histórico de chat.

**Estrutura obrigatória do PROGRESS.md:**

````markdown
# Progress — <Nome da Feature>

**Branch:** `feat/<nome-da-feature>`
**Referências:** `SPEC.md` | `TASK-MANAGER.md`

---

## Status das Tasks

| Task | Status | Resumo |
|---|---|---|
| T0 — <Nome> | ✅ Concluída | <1 linha do que foi feito> |
| T1 — <Nome> | 🔄 Em progresso | <onde está> |
| T2 — <Nome> | ⏳ Pendente | — |
| T3 — <Nome> | ❌ Bloqueada | <motivo do bloqueio> |

> Legenda: ✅ Concluída · 🔄 Em progresso · ⏳ Pendente · ❌ Bloqueada

---

## Log de Execução

### T0 — <Nome> ✅
**O que funcionou:** <breve descrição do que foi implementado com sucesso>
**Dificuldades:** <problemas encontrados e como foram resolvidos>
**Desvios do plano:** <o que foi diferente do TASK-MANAGER.md e por quê>

### T1 — <Nome> 🔄
**Estado atual:** <o que já foi feito dentro desta task>
**Próximos passos:** <o que falta para concluir>
**Bloqueios:** <se houver, o que impede o avanço>

---

## Contexto para a próxima sessão

**Última task concluída:** T0
**Task atual / próxima:** T1
**Estado do ambiente:** <branch, build passando ou não, testes rodando>
**Atenção:** <algo crítico que a próxima sessão precisa saber antes de continuar>
````

**Regras do PROGRESS.md:**
- Atualizar **obrigatoriamente** ao final de cada task concluída — não deixar para depois
- O campo "Contexto para a próxima sessão" deve ser suficiente para retomar o trabalho sem ler o histórico de chat
- "Desvios do plano" é obrigatório mesmo que seja "nenhum" — confirma que o plano foi seguido
- Se uma task foi bloqueada, documentar o bloqueio antes de mudar de assunto
- Nunca apagar entradas antigas — o histórico de acertos e erros é parte do valor do documento

---

## Checklist de qualidade antes de entregar os artefatos

### SPEC.md
- [ ] Tem seção de escopo explícito (no escopo / fora do escopo)
- [ ] Tem tabela de riscos com coluna de mitigação
- [ ] Menciona segurança (campos de password, API keys, clipboard)
- [ ] Tem checklist de merge na seção final
- [ ] Idioma: Português
- [ ] Tamanho: 300–500 linhas

### TASK-MANAGER.md
- [ ] Plano de Execução com fases sequenciais/paralelas e descrição por fase
- [ ] Task Breakdown com todos os campos (What, Where, Dependências, Reuses, Requisitos, Pré-requisitos, Done when)
- [ ] "Done when" é verificável em todas as tasks
- [ ] Dependências entre tasks são explícitas

### Arquivos de task
- [ ] Cada task tem modelo recomendado com justificativa
- [ ] Cada task tem tabela de skills a ler antes de implementar
- [ ] Cada task tem critério de saída com checklist
- [ ] Código concreto (não só pseudocódigo)
- [ ] T0 limpa código obsoleto
- [ ] Task final aponta para `finishing-a-development-branch`
- [ ] TDD: testes aparecem antes da implementação em cada task

### README.md
- [ ] Tabela de todos os arquivos (incluindo TASK-MANAGER.md e PROGRESS.md)
- [ ] Tabela de tasks com modelo recomendado
- [ ] Princípio central em 1-2 frases
- [ ] Dependências novas listadas

### PROGRESS.md
- [ ] Criado antes de iniciar T0
- [ ] Tabela de status com todas as tasks listadas
- [ ] "Contexto para a próxima sessão" preenchido após cada task
- [ ] "Desvios do plano" registrado mesmo quando é "nenhum"

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
| Escrever código antes de ter o SPEC aprovado | SPEC → aprovação → tasks |
| Task com pseudocódigo vago ("implementar X") | Código concreto com imports, assinaturas e lógica |
| Misturar Rust e React na mesma task | Uma task por camada |
| SPEC sem seção de riscos | Sempre incluir riscos, mesmo que o impacto seja baixo |
| Escolher Sonnet para task com Rust async | Usar Opus para qualquer task com MutexGuard/lifetimes/threads |
| Não referenciar skills no cabeçalho de cada task | Sempre listar skills relevantes — o implementador não vai lembrar |
| Criar spec genérico ("passive-suggestions") para feature específica | Nome específico + extensível via pastas irmãs |
| Começar implementação sem worktree | Sempre criar branch isolada via `superpowers:using-git-worktrees` |
| "Done when" vago ("quando funcionar") | Critério verificável: teste que passa, ação mensurável |
| Task sem campo de Dependências | Sempre declarar dependências, mesmo que sejam "—" (nenhuma) |
| Não criar PROGRESS.md antes de T0 | Criar antes da primeira task — a estrutura vazia já é contexto útil |
| Atualizar PROGRESS.md "depois" ao invés de imediatamente | Atualizar ao final de cada task, enquanto o contexto ainda está fresco |
| Apagar entradas antigas do log de execução | Nunca apagar — o histórico de erros e acertos é parte do valor do documento |
