// src/renderer/lib/ai.test.ts
import { describe, it, expect } from 'vitest'
import { parseAIResponse } from './ai'
import type { VerbForms } from '../../types'

const VERB_FORMS: VerbForms = {
  infinitive: 'to churn',
  past: 'churned',
  past_participle: 'churned',
  present_participle: 'churning',
  third_person: 'churns',
}

const FULL_RESPONSE = {
  word: 'churn',
  phonetic: 'tʃɜːrn',
  pos: 'verb',
  verb_forms: VERB_FORMS,
  level: 'Advanced',
  meanings: [
    {
      context: 'Literal',
      meaning_en: 'To agitate or stir something vigorously.',
      meaning_short: 'Agitar ou mexer algo vigorosamente.',
      meaning: 'Agitar intensamente algo, causando movimento turbulento.',
      examples: [
        { en: 'Her stomach churned with anxiety.', translation: 'Seu estômago revirou de ansiedade.' },
        { en: 'Stop churning the water.', translation: 'Pare de agitar a água.' },
      ],
    },
    {
      context: 'Business',
      meaning_en: 'To produce something in large quantities, often mechanically.',
      meaning_short: 'Produzir algo em grandes quantidades.',
      meaning: 'Quando uma fábrica ou empresa produz algo em massa, quase no automático.',
      examples: [
        { en: 'The factory churns out cars daily.', translation: 'A fábrica produz carros diariamente.' },
      ],
    },
    {
      context: 'Informal',
      meaning_en: 'To feel unsettled or experience inner turmoil.',
      meaning_short: 'Sentir-se inquieto ou em turbulência interna.',
      meaning: 'Aquela sensação de inquietação, quando algo te deixa agitado por dentro.',
      examples: [
        { en: 'My mind was churning after the argument.', translation: 'Minha mente estava agitada depois da discussão.' },
      ],
    },
  ],
  synonyms: ['agitate', 'stir', 'shake'],
  antonyms: ['calm', 'soothe'],
  contexts: ['Business', 'Informal'],
}

// ---------------------------------------------------------------------------
// parseAIResponse — meanings com exemplos
// ---------------------------------------------------------------------------
describe('parseAIResponse — meanings com exemplos', () => {
  it('extrai verb_forms corretamente para verbos', () => {
    const result = parseAIResponse(JSON.stringify(FULL_RESPONSE))
    expect(result.verb_forms).toEqual(VERB_FORMS)
  })

  it('extrai múltiplos meanings com campos completos', () => {
    const result = parseAIResponse(JSON.stringify(FULL_RESPONSE))
    expect(result.meanings).toHaveLength(3)
    expect(result.meanings[0].context).toBe('Literal')
    expect(result.meanings[0].meaning_en).toBe('To agitate or stir something vigorously.')
    expect(result.meanings[0].meaning_short).toBe('Agitar ou mexer algo vigorosamente.')
    expect(result.meanings[0].meaning).toBe('Agitar intensamente algo, causando movimento turbulento.')
  })

  it('cada meaning tem seus próprios exemplos', () => {
    const result = parseAIResponse(JSON.stringify(FULL_RESPONSE))
    expect(result.meanings[0].examples).toHaveLength(2)
    expect(result.meanings[0].examples[0].en).toBe('Her stomach churned with anxiety.')
    expect(result.meanings[1].examples).toHaveLength(1)
    expect(result.meanings[1].examples[0].en).toBe('The factory churns out cars daily.')
    expect(result.meanings[2].examples).toHaveLength(1)
  })

  it('extrai terceiro meaning com context diferente', () => {
    const result = parseAIResponse(JSON.stringify(FULL_RESPONSE))
    expect(result.meanings[2].context).toBe('Informal')
    expect(result.meanings[2].meaning_en).toBe('To feel unsettled or experience inner turmoil.')
  })

  it('extrai antonyms corretamente', () => {
    const result = parseAIResponse(JSON.stringify(FULL_RESPONSE))
    expect(result.antonyms).toEqual(['calm', 'soothe'])
  })

  it('aceita verb_forms null para palavras que não são verbos', () => {
    const noun = { ...FULL_RESPONSE, pos: 'noun', verb_forms: null }
    const result = parseAIResponse(JSON.stringify(noun))
    expect(result.verb_forms).toBeNull()
  })

  it('aceita antonyms como array vazio', () => {
    const noAntonyms = { ...FULL_RESPONSE, antonyms: [] }
    const result = parseAIResponse(JSON.stringify(noAntonyms))
    expect(result.antonyms).toEqual([])
  })

  it('aceita meanings com 2 significados (mínimo)', () => {
    const two = { ...FULL_RESPONSE, meanings: FULL_RESPONSE.meanings.slice(0, 2) }
    const result = parseAIResponse(JSON.stringify(two))
    expect(result.meanings).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// parseAIResponse — campos existentes não afetados
// ---------------------------------------------------------------------------
describe('parseAIResponse — campos existentes', () => {
  it('extrai word, phonetic, pos, level corretamente', () => {
    const result = parseAIResponse(JSON.stringify(FULL_RESPONSE))
    expect(result.word).toBe('churn')
    expect(result.phonetic).toBe('tʃɜːrn')
    expect(result.pos).toBe('verb')
    expect(result.level).toBe('Advanced')
  })

  it('extrai meanings e examples corretamente', () => {
    const result = parseAIResponse(JSON.stringify(FULL_RESPONSE))
    expect(result.meanings).toHaveLength(3)
    expect(result.meanings[0].meaning).toBe('Agitar intensamente algo, causando movimento turbulento.')
    expect(result.meanings[0].examples).toHaveLength(2)
    expect(result.meanings[0].examples[0].en).toBe('Her stomach churned with anxiety.')
    expect(result.meanings[0].examples[0].translation).toBe('Seu estômago revirou de ansiedade.')
  })

  it('extrai synonyms e contexts corretamente', () => {
    const result = parseAIResponse(JSON.stringify(FULL_RESPONSE))
    expect(result.synonyms).toEqual(['agitate', 'stir', 'shake'])
    expect(result.contexts).toEqual(['Business', 'Informal'])
  })
})

// ---------------------------------------------------------------------------
// parseAIResponse — robustez
// ---------------------------------------------------------------------------
describe('parseAIResponse — robustez', () => {
  it('remove markdown code fences antes de parsear', () => {
    const withFences = `\`\`\`json\n${JSON.stringify(FULL_RESPONSE)}\n\`\`\``
    const result = parseAIResponse(withFences)
    expect(result.word).toBe('churn')
    expect(result.verb_forms).toEqual(VERB_FORMS)
  })

  it('remove code fence sem linguagem especificada', () => {
    const withFences = `\`\`\`\n${JSON.stringify(FULL_RESPONSE)}\n\`\`\``
    const result = parseAIResponse(withFences)
    expect(result.word).toBe('churn')
  })

  it('lança erro para JSON inválido', () => {
    expect(() => parseAIResponse('not valid json')).toThrow('Invalid JSON response from AI')
  })

  it('lança erro para string vazia', () => {
    expect(() => parseAIResponse('')).toThrow('Invalid JSON response from AI')
  })
})
