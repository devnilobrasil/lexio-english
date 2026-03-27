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
  meaning: 'Agitar intensamente algo, causando movimento turbulento.',
  meaning_en: 'To agitate or stir something vigorously.',
  examples: [
    { en: 'The factory churns out cars daily.', translation: 'A fábrica produz carros diariamente.' },
    { en: 'Her stomach churned with anxiety.', translation: 'Seu estômago revirou de ansiedade.' },
    { en: 'Stop churning the water.', translation: 'Pare de agitar a água.' },
  ],
  synonyms: ['agitate', 'stir', 'shake'],
  antonyms: ['calm', 'soothe'],
  contexts: ['Business', 'Informal'],
  tip: 'Não confunda "churn" com "burn" — a diferença está no "ch" inicial.',
}

// ---------------------------------------------------------------------------
// parseAIResponse — campos novos
// ---------------------------------------------------------------------------
describe('parseAIResponse — campos novos', () => {
  it('extrai verb_forms corretamente para verbos', () => {
    const result = parseAIResponse(JSON.stringify(FULL_RESPONSE))
    expect(result.verb_forms).toEqual(VERB_FORMS)
  })

  it('extrai meaning_en corretamente', () => {
    const result = parseAIResponse(JSON.stringify(FULL_RESPONSE))
    expect(result.meaning_en).toBe('To agitate or stir something vigorously.')
  })

  it('extrai antonyms corretamente', () => {
    const result = parseAIResponse(JSON.stringify(FULL_RESPONSE))
    expect(result.antonyms).toEqual(['calm', 'soothe'])
  })

  it('extrai tip corretamente', () => {
    const result = parseAIResponse(JSON.stringify(FULL_RESPONSE))
    expect(result.tip).toBe('Não confunda "churn" com "burn" — a diferença está no "ch" inicial.')
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

  it('extrai meaning e examples corretamente', () => {
    const result = parseAIResponse(JSON.stringify(FULL_RESPONSE))
    expect(result.meaning).toBe('Agitar intensamente algo, causando movimento turbulento.')
    expect(result.examples).toHaveLength(3)
    expect(result.examples[0].en).toBe('The factory churns out cars daily.')
    expect(result.examples[0].translation).toBe('A fábrica produz carros diariamente.')
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
