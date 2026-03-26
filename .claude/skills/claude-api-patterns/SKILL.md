---
name: claude-api-patterns
description: Padrões para uso da Claude API no Lexio — wrapper, system prompt, formato JSON esperado, parsing seguro e cache SQLite. Consultar antes de qualquer modificação em src/renderer/lib/claude.ts.
---

# Claude API Patterns Skill

## Onde Fica e Quem Chama

```
src/renderer/lib/claude.ts   ← wrapper da API (única chamada de rede no renderer)
         ↑
src/renderer/hooks/useSearch.ts  ← chama fetchWordFromClaude() se palavra não está no cache
         ↑
window.lexio.getWord()  ← primeiro verifica SQLite antes de chamar a API
```

**Fluxo de cache:**
1. Renderer chama `window.lexio.getWord(palavra)`
2. Main busca no SQLite
3. **Se encontrou** → retorna imediatamente (zero custo, zero latência)
4. **Se não encontrou** → renderer chama `fetchWordFromClaude(palavra)`
5. Renderer chama `window.lexio.saveWord(resultado)` → grava no SQLite
6. `view_count` e `last_viewed` atualizam a cada visualização

---

## Modelo e Configuração

```ts
// Modelo atual
model: 'claude-sonnet-4-20250514'

// Limites
max_tokens: 1000  // suficiente para o JSON completo
```

**❌ Não trocar o modelo sem testar:** Modelos diferentes têm comportamentos diferentes para JSON estruturado. `claude-sonnet-4-20250514` foi calibrado para este prompt.

---

## System Prompt

```ts
const SYSTEM_PROMPT = `Você é um dicionário de inglês especializado para falantes de português brasileiro.
Responda APENAS com JSON válido, sem markdown, sem texto extra.`
```

**Regras:**
- Não modificar sem testar o output resultante
- A instrução "sem markdown" é crítica — a Claude às vezes envolve JSON em ` ```json ``` `
- "Apenas JSON" — sem prefixos, sem explicações

---

## Formato JSON Esperado (`ClaudeWordResponse`)

```ts
// src/types/index.ts
export type ClaudeWordResponse = {
  word: string
  phonetic: string | null          // IPA, ex: "tʃɜːrn"
  pos: PartOfSpeech | null         // "verb" | "noun" | "adjective" | "adverb" | "phrase" | "idiom"
  level: WordLevel | null          // "Básico" | "Intermediário" | "Avançado" | "Técnico"
  meaning_pt: string               // significado completo em PT-BR
  meaning_en: string | null        // definição simples em inglês (1-2 frases)
  examples: WordExample[]          // 3 exemplos [{en, pt}]
  synonyms: string[]               // 3 palavras relacionadas
  contexts: string[]               // de: Negócios, Tecnologia, Informal, Formal, Finanças,
                                   //     Marketing, RH, Jurídico, Medicina, Gíria
}
```

---

## User Prompt (não modificar sem consciência)

```ts
const buildUserPrompt = (word: string): string => `
Para a palavra "${word}", retorne exatamente este JSON:
{
  "word": "${word}",
  "phonetic": "transcrição IPA, ex: tʃɜːrn",
  "pos": "verb|noun|adjective|adverb|phrase|idiom",
  "level": "Básico|Intermediário|Avançado|Técnico",
  "meaning_pt": "significado completo em português brasileiro",
  "meaning_en": "simple English definition, 1-2 sentences",
  "examples": [
    {"en": "exemplo em inglês", "pt": "tradução natural"},
    {"en": "segundo exemplo",   "pt": "tradução"},
    {"en": "terceiro exemplo",  "pt": "tradução"}
  ],
  "synonyms": ["palavra1", "palavra2", "palavra3"],
  "contexts": ["Negócios", "Tecnologia"]
}
Contextos possíveis: Negócios, Tecnologia, Informal, Formal, Finanças, Marketing, RH, Jurídico, Medicina, Gíria`
```

---

## Pattern de Parsing Seguro (CRÍTICO)

A Claude, mesmo com instrução "sem markdown", pode às vezes retornar o JSON dentro de um bloco de código. O parsing deve sempre remover isso antes do `JSON.parse`:

```ts
export async function fetchWordFromClaude(word: string): Promise<ClaudeWordResponse> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(word) }],
    }),
  })

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`)

  const data = await response.json()
  const text: string = data.content?.[0]?.text ?? ''
  
  // ← CRÍTICO: remove markdown fencing se a Claude ignorar a instrução
  const clean = text.replace(/```json|```/g, '').trim()
  
  return JSON.parse(clean) as ClaudeWordResponse
}
```

---

## Variável de Ambiente

```bash
# .env na raiz do projeto
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

```ts
// No renderer — acessível via Vite
const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string
```

**Segurança:**
- A chave fica exposta no bundle do renderer (Electron não tem backend)
- O risco é aceitável porque o Electron não serve o app publicamente
- Nunca commitar o `.env` no Git (já está no `.gitignore`)
- Em produção, considerar mover a chamada à API para o processo main e usar variável de ambiente do OS

---

## Como Adicionar um Novo Campo ao Output

Exemplo — adicionar campo `difficulty_score`:

### 1. Atualizar o tipo

```ts
// src/types/index.ts
export type ClaudeWordResponse = {
  // ...campos existentes...
  difficulty_score: number | null  // 1-10, null se não aplicável
}
```

### 2. Atualizar o prompt

```ts
// Em buildUserPrompt(), adicionar ao JSON template:
"difficulty_score": 7
// E na instrução:
// difficulty_score: número de 1 (muito fácil) a 10 (muito difícil), baseado no nível de vocabulário
```

### 3. Atualizar o schema SQLite

```ts
// src/main/db.ts — na função init(), após o schema base:
const columns = db.prepare(`PRAGMA table_info(words)`).all() as Array<{name: string}>
if (!columns.some(c => c.name === 'difficulty_score')) {
  db.exec(`ALTER TABLE words ADD COLUMN difficulty_score INTEGER`)
}
```

### 4. Atualizar serialize/deserialize

```ts
// serialize() em db.ts — adicionar o campo ao objeto
// deserialize() — o campo é escalar (não JSON), não precisa de parse
```

---

## Tratamento de Erros

```ts
// No hook useSearch.ts
try {
  const result = await fetchWordFromClaude(word)
  await window.lexio.saveWord(result)
} catch (err) {
  if (err instanceof SyntaxError) {
    // JSON inválido — Claude retornou algo inesperado
    console.error('Claude retornou JSON inválido:', err)
    setError('Erro ao processar resposta. Tente novamente.')
  } else {
    // Erro de rede ou API
    console.error('Claude API error:', err)
    setError('Sem conexão ou API indisponível.')
  }
}
```

---

## ❌ Proibido

```ts
// ❌ JSON.parse sem remover markdown fencing
const result = JSON.parse(text)  // falha se Claude usar ```json ... ```

// ❌ Chamar Claude API sem verificar cache primeiro
const result = await fetchWordFromClaude(word)  // verifica SQLite antes!

// ❌ Expor a API key como hardcoded
headers: { 'x-api-key': 'sk-ant-abc123' }

// ❌ Trocar modelo sem testar
model: 'claude-opus-4-5'  // modelos diferentes = output diferente
```

---

## Checklist

Antes de modificar `claude.ts` ou o sistema de busca:

- [ ] Verificar se a mudança quebra o formato `ClaudeWordResponse`
- [ ] Testar o parsing com `JSON.parse(clean)` após `text.replace(...)`
- [ ] Se adicionou campo novo: atualizar tipos + schema SQLite + prompt
- [ ] Confirmar que o cache SQLite ainda é verificado ANTES da chamada à API
- [ ] API key lida via `import.meta.env.VITE_ANTHROPIC_API_KEY` (não hardcoded)

---

## Priority Level: HIGH

Mudanças no prompt ou modelo sem teste podem resultar em JSON inválido para todas as buscas novas.
