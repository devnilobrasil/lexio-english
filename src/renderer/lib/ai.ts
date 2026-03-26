// src/renderer/lib/ai.ts
import type { AIWordResponse, Locale } from '../../types'

const SYSTEM_PROMPT = `You are an English dictionary specialized for language learners.
Respond ONLY with valid JSON, no markdown, no extra text.`

const LOCALE_INSTRUCTIONS: Record<Locale, string> = {
  'pt-BR': 'Provide the meaning and example translations in Brazilian Portuguese.',
  'en':    'Provide the meaning and example translations in English.',
  'es':    'Provide the meaning and example translations in Spanish.',
}

const buildUserPrompt = (word: string, locale: Locale): string => `
For the English word "${word}", return exactly this JSON:
{
  "word": "${word}",
  "phonetic": "IPA transcription, e.g. tʃɜːrn",
  "pos": "verb|noun|adjective|adverb|phrase|idiom",
  "level": "Basic|Intermediate|Advanced|Technical",
  "meaning": "definition in the target language",
  "examples": [
    {"en": "example sentence in English", "translation": "translation"},
    {"en": "second example",              "translation": "translation"},
    {"en": "third example",               "translation": "translation"}
  ],
  "synonyms": ["word1", "word2", "word3"],
  "contexts": ["Business", "Technology"]
}
${LOCALE_INSTRUCTIONS[locale]}
Possible contexts: Business, Technology, Informal, Formal, Finance, Marketing, HR, Legal, Medicine, Slang`

export async function fetchWordFromGroq(word: string, locale: Locale): Promise<AIWordResponse> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string
  if (!apiKey) throw new Error('Groq API key not found (VITE_GROQ_API_KEY)')

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
        { role: 'user',   content: buildUserPrompt(word, locale) },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) throw new Error(`Groq API error: ${response.status}`)

  const data = await response.json()
  const text: string = data.choices?.[0]?.message?.content ?? ''
  return parseAIResponse(text)
}

function parseAIResponse(text: string): AIWordResponse {
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean) as AIWordResponse
  } catch {
    console.error('Failed to parse AI response:', text)
    throw new Error('Invalid JSON response from AI')
  }
}

export async function fetchWordFromAI(word: string, locale: Locale): Promise<AIWordResponse> {
  return fetchWordFromGroq(word, locale)
}
