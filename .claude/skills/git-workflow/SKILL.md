---
name: git-workflow
description: Orientações de git para o projeto Lexio — branch, commit, push e criação de PR. Usa o GitHub MCP quando disponível para criar PRs automaticamente.
context: fork
---

# Git Workflow Skill

## Auto-Execution Protocol

When user assigns a development task, EXECUTE THIS SEQUENCE:

### STEP 1: CREATE BRANCH (FIRST ACTION - BEFORE ANY CODE)
```bash
git checkout -b <type>/<description>
```

**Branch Types:**
- `feat/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code restructuring
- `docs/` - Documentation
- `test/` - Test additions
- `chore/` - Maintenance tasks

**Example:** `git checkout -b feat/search-history`

---

### STEP 2: IMPLEMENT CHANGES
- Follow all architecture rules from other skills
- Maintain file size limits (150 lines per file)
- Use TypeScript strictly (no `any`)

---

### STEP 2.5: VALIDATE — BUILD

```bash
npm run build:renderer
```

**If build fails:**
- Analyze error output
- Fix the root cause (do not suppress errors or disable rules)
- Re-run until successful

**Only proceed to STEP 3 after build exits with code 0.**

> Note: O Lexio não tem `npm run lint` configurado. Validar apenas com build.

---

### STEP 3: CONVENTIONAL COMMIT
```bash
git add .
git commit -m "<type>: <description>"
```

**Commit Format Rules:**
- Lowercase only
- Imperative mood ("add" not "added")
- No period at end
- Max 72 characters
- Start with type from branch types

**Examples:**
✅ `feat: add word search history display`
✅ `fix: resolve json parse error on empty synonyms`
✅ `refactor: extract db queries to dedicated functions`
❌ `Added new feature.` (wrong tense, has period)
❌ `Fix bug` (too vague)

---

### STEP 4: PUSH TO ORIGIN
```bash
git push origin <branch-name>
```

---

### STEP 5: CREATE PULL REQUEST

**Priority Order — use the FIRST available option:**

#### A) MCP GitHub Tool (PREFERRED — invoke `github-operator` subagent)

Se o GitHub MCP estiver disponível (`create_pull_request` tool acessível):

```
Delegate to the github-operator subagent:
- title: same as commit message
- body: list of changes + checklist
- base: "stage" (NEVER main)
- head: current branch name
```

O subagent `github-operator` saberá usar as ferramentas corretas do MCP.

#### B) GitHub CLI (se MCP indisponível)
```bash
gh pr create \
  --title "feat: description" \
  --body "## Changes\n- item 1\n\n## Checklist\n- [ ] Build passing\n- [ ] Tested manually" \
  --base stage
```

#### C) Manual URL (fallback final)
```bash
echo "https://github.com/devnilobrasil/lexio/compare/stage...$(git branch --show-current)?expand=1"
```

---

## Completion Checklist

Before declaring task complete, verify:
- [ ] Branch created with conventional naming
- [ ] Code changes implemented following project skills
- [ ] Build passed (`npm run build:renderer`)
- [ ] Committed with conventional format
- [ ] Pushed to origin
- [ ] PR created targeting `stage` branch (via MCP, CLI ou URL)

---

## Response Template

Always end tasks with:
```
✅ Task completed:

Branch: feat/feature-name
Commit: feat: add feature description
Build: ✅ passed
PR: [link or URL] → stage

Changes:
- [list key changes]
- [list affected files]

Next: Review PR, merge to stage
```

---

## ❌ FORBIDDEN ACTIONS

- Committing directly to main/stage/production
- Skipping branch creation
- Non-conventional commit messages
- Committing code that fails build
- Creating PRs targeting main/production
- Declaring "task complete" without PR link

---

## Priority Level: CRITICAL

This workflow is MANDATORY for ALL code changes.
Task is considered INCOMPLETE without PR creation.