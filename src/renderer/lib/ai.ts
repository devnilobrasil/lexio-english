// src/renderer/lib/ai.ts
import type { ClaudeWordResponse } from '../../types'

const SYSTEM_PROMPT = `Você é um dicionário de inglês especializado para falantes de português brasileiro.
Responda APENAS com JSON válido, sem markdown, sem texto extra.`

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

/* 
export async function fetchWordFromClaude(word: string): Promise<ClaudeWordResponse> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string
  if (!apiKey) throw new Error('Claude API Key not found')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'dangerously-allow-browser': 'true'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(word) }],
    }),
  })

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`)

  const data = await response.json()
  const text: string = data.content?.[0]?.text ?? ''
  return parseAIResponse(text)
}
*/

export async function fetchWordFromGroq(word: string): Promise<ClaudeWordResponse> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string
  if (!apiKey) throw new Error('Groq API Key não encontrada no .env (VITE_GROQ_API_KEY)')

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(word) }
      ],
      response_format: { type: 'json_object' }
    }),
  })

  if (!response.ok) throw new Error(`Groq API error: ${response.status}`)

  const data = await response.json()
  const text: string = data.choices?.[0]?.message?.content ?? ''
  return parseAIResponse(text)
}

function parseAIResponse(text: string): ClaudeWordResponse {
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean) as ClaudeWordResponse
  } catch (e) {
    console.error('Failed to parse AI response:', text)
    throw new Error('Resposta JSON inválida da IA')
  }
}

// Helper para escolher o provedor (Groq como padrão)
export async function fetchWordFromAI(word: string): Promise<ClaudeWordResponse> {
  // Forçamos o uso do Groq conforme solicitado
  return fetchWordFromGroq(word)
}
