---
name: sqlite-patterns
description: Padrões de acesso ao banco de dados SQLite do Lexio via better-sqlite3. Inclui regras de onde colocar queries, como serializar/deserializar campos JSON, e como alterar o schema com segurança.
---

# SQLite Patterns Skill

## Princípios do DB

- **Síncrono por design:** `better-sqlite3` é completamente síncrono. Não há `await`, não há Promises. É mais rápido que drivers assíncronos para apps de um único usuário.
- **Centralizado:** TODA lógica SQL fica em `src/main/db.ts`. Nunca em `ipc.ts`, nunca no renderer.
- **Offline-first:** O banco vive em `app.getPath('userData')`. Sem dependência de rede.

---

## Localização do Banco

```ts
// src/main/db.ts
import { app } from 'electron'
import path from 'path'
import Database from 'better-sqlite3'

let db: Database.Database

export function init(): void {
  db = new Database(path.join(app.getPath('userData'), 'lexio.db'))
  // ...migrations/schema
}
```

| OS | Caminho do arquivo |
|---|---|
| Windows | `%APPDATA%\lexio\lexio.db` |
| macOS | `~/Library/Application Support/lexio/lexio.db` |
| Linux | `~/.config/lexio/lexio.db` |

---

## Schema Atual

```sql
CREATE TABLE IF NOT EXISTS words (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  word         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phonetic     TEXT,
  pos          TEXT,                         -- 'verb' | 'noun' | 'adjective' | ...
  level        TEXT,                         -- 'Básico' | 'Intermediário' | 'Avançado' | 'Técnico'
  meaning_pt   TEXT NOT NULL,
  meaning_en   TEXT,
  examples     TEXT,   -- JSON serializado: [{en, pt}, ...]
  synonyms     TEXT,   -- JSON serializado: ["word1", "word2"]
  contexts     TEXT,   -- JSON serializado: ["Negócios", "Tech"]
  created_at   TEXT DEFAULT (datetime('now')),
  last_viewed  TEXT DEFAULT (datetime('now')),
  view_count   INTEGER DEFAULT 1,
  is_saved     INTEGER DEFAULT 0             -- SQLite não tem boolean: 0 ou 1
);
```

---

## O Pattern Crítico: Serialize / Deserialize

Campos `examples`, `synonyms` e `contexts` são **arrays TypeScript** no código mas **strings JSON** no banco.

### Interface Raw (como vem do SQLite)

```ts
// Linha raw — campos JSON ainda como string
interface WordRow extends Omit<Word, 'examples' | 'synonyms' | 'contexts'> {
  examples: string
  synonyms: string
  contexts: string
}
```

### Funções de Conversão (SEMPRE usar)

```ts
// Antes de gravar no banco
function serialize(data: ClaudeWordResponse) {
  return {
    ...data,
    examples: JSON.stringify(data.examples ?? []),
    synonyms: JSON.stringify(data.synonyms ?? []),
    contexts: JSON.stringify(data.contexts ?? []),
  }
}

// Depois de ler do banco
function deserialize(row: WordRow): Word {
  return {
    ...row,
    examples: JSON.parse(row.examples ?? '[]'),
    synonyms: JSON.parse(row.synonyms ?? '[]'),
    contexts: JSON.parse(row.contexts ?? '[]'),
  }
}
```

**Regra:** Todas as funções que leem do banco devem chamar `deserialize()`. Todas que gravam devem chamar `serialize()`.

---

## Padrões de Query

### Leitura simples

```ts
export function getWord(word: string): Word | null {
  const row = db.prepare('SELECT * FROM words WHERE word = ?').get(word) as WordRow | undefined
  if (!row) return null
  // Atualiza métricas de visualização
  db.prepare(
    `UPDATE words SET view_count = view_count + 1, last_viewed = datetime('now') WHERE word = ?`
  ).run(word)
  return deserialize(row)
}
```

### Upsert (INSERT ou UPDATE se já existe)

```ts
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
```

### Toggle booleano (SQLite usa 0/1)

```ts
export function toggleSaved(word: string): Word {
  db.prepare(
    `UPDATE words SET is_saved = CASE WHEN is_saved = 1 THEN 0 ELSE 1 END WHERE word = ?`
  ).run(word)
  return getWord(word)!
}
```

### Listagens com ORDER e LIMIT

```ts
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
```

---

## Como Adicionar uma Nova Query

1. **Adicionar o tipo** em `src/types/index.ts` se necessário
2. **Escrever a função** em `src/main/db.ts`
3. **Registrar o handler** em `src/main/ipc.ts` (`ipcMain.handle(...)`)
4. **Expor no preload** em `src/preload/index.ts`
5. **Consumir no hook** em `src/renderer/hooks/`

Exemplo — nova query de busca por nível:

```ts
// src/main/db.ts
export function getWordsByLevel(level: WordLevel): Word[] {
  return (
    db.prepare('SELECT * FROM words WHERE level = ? ORDER BY word ASC').all(level) as WordRow[]
  ).map(deserialize)
}
```

---

## Como Alterar o Schema (Migration)

`better-sqlite3` não tem sistema de migrations nativo. O Lexio usa um setup manual no `init()`:

```ts
export function init(): void {
  db = new Database(path.join(app.getPath('userData'), 'lexio.db'))
  
  // Schema base
  db.exec(`CREATE TABLE IF NOT EXISTS words (...)`)
  
  // Migrations — verificar se coluna existe antes de adicionar
  const columns = db.prepare(`PRAGMA table_info(words)`).all() as Array<{name: string}>
  const hasNewColumn = columns.some(c => c.name === 'difficulty_score')
  
  if (!hasNewColumn) {
    db.exec(`ALTER TABLE words ADD COLUMN difficulty_score INTEGER DEFAULT 0`)
  }
}
```

**Regra:** Sempre usar `PRAGMA table_info(tableName)` para verificar antes de `ALTER TABLE`.

---

## ❌ Proibido

```ts
// ❌ SQL em ipc.ts
ipcMain.handle('word:get', (_, word) => {
  return db.prepare('SELECT * FROM words WHERE word = ?').get(word)  // vai em db.ts!
})

// ❌ SQL no renderer
// O renderer não tem acesso a `db` — contextBridge bloqueia

// ❌ Retornar WordRow sem deserializar
return db.prepare('SELECT * FROM words').all()  // arrays virão como strings JSON!

// ❌ await em queries better-sqlite3
const word = await db.prepare('SELECT...').get(word)  // better-sqlite3 é SÍNCRONO

// ❌ boolean nativo
db.prepare('UPDATE words SET is_saved = ?').run(true)  // usar 0 ou 1
```

---

## Checklist de Validação

Antes de submeter qualquer mudança no banco:

- [ ] Queries em `src/main/db.ts` (não em outros ficheiros)
- [ ] Funções que retornam `Word` chamam `deserialize(row)`
- [ ] Funções que gravam arrays chamam `serialize(data)`
- [ ] Zero `await` em funções do `db.ts`
- [ ] Booleans representados como `0 | 1` (não `true/false`)
- [ ] Novas colunas verificam existência antes de `ALTER TABLE`
- [ ] Tipos atualizados em `src/types/index.ts`

---

## Priority Level: HIGH

Erros de serialização são silenciosos (arrays viram strings) e difíceis de debugar.  
Sempre usar o pattern serialize/deserialize sem exceção.
