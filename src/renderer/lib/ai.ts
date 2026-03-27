// src/renderer/lib/ai.ts
import type { AIWordResponse, Locale } from '../../types'

const SYSTEM_PROMPT = `You are an expert English lexicographer and language teacher specialized in helping non-native speakers truly understand and retain English vocabulary.

Your responses must follow these quality standards:
- Phonetic transcription must be accurate IPA notation
- Meanings must be clear, natural, and written as a native speaker of the target language would explain it — not a literal translation
- Examples must be real-world, practical sentences that reflect how the word is actually used today — avoid generic or overly simple sentences
- For verbs, at least one example must show the word in a natural conversational or professional context
- Synonyms must be genuinely interchangeable in at least one common context
- Level assessment: Basic (A1-A2), Intermediate (B1-B2), Advanced (C1-C2), Technical (domain-specific jargon)
- Respond ONLY with valid JSON, no markdown, no extra text, no explanations`

const LOCALE_NAMES: Record<Locale, string> = {
  'pt-BR': 'Brazilian Portuguese',
  'es': 'Spanish',
}

const LOCALE_INSTRUCTIONS: Record<Locale, string> = {
  'pt-BR': `- "meaning" must be written in natural Brazilian Portuguese, as a Brazilian would explain it to a friend — not a dictionary translation
- "translation" in examples must sound natural in Brazilian Portuguese, not word-for-word
- "tip" must be written in Brazilian Portuguese
- Use Brazilian vocabulary and expressions, not European Portuguese`,
  'es': `- "meaning" must be written in natural Spanish, as a native speaker would explain it to a friend
- "translation" in examples must sound natural in Spanish, not word-for-word
- "tip" must be written in Spanish`,
}

const buildUserPrompt = (word: string, locale: Locale): string => `
For the English word "${word}", return exactly this JSON structure with no deviations:

{
  "word": "${word}",
  "phonetic": "accurate IPA transcription",
  "pos": "one of: verb | noun | adjective | adverb | phrase | idiom | conjunction | preposition",
  "verb_forms": {
    "infinitive": "to ${word}",
    "past": "past tense form",
    "past_participle": "past participle form",
    "present_participle": "present participle form",
    "third_person": "third person singular present"
  },
  "level": "one of: Basic | Intermediate | Advanced | Technical",
  "meaning": "clear and natural explanation in ${LOCALE_NAMES[locale]} — explain it like a knowledgeable friend would, not a dictionary",
  "meaning_en": "concise English definition in plain language, 1 sentence max",
  "examples": [
    {
      "en": "natural, real-world sentence showing the word in a professional or everyday context",
      "translation": "natural translation in ${LOCALE_NAMES[locale]}"
    },
    {
      "en": "sentence showing the word in a different context or grammatical structure than example 1",
      "translation": "natural translation in ${LOCALE_NAMES[locale]}"
    },
    {
      "en": "sentence that could appear in a book, article, podcast, or real conversation",
      "translation": "natural translation in ${LOCALE_NAMES[locale]}"
    }
  ],
  "synonyms": ["3 to 5 genuinely interchangeable synonyms in common contexts"],
  "antonyms": ["1 to 3 antonyms if applicable, empty array if none"],
  "contexts": ["1 to 3 contexts where this word is most commonly used"],
  "tip": "one practical memorization tip or common mistake to avoid, written in ${LOCALE_NAMES[locale]}"
}

Rules:
- If the word is NOT a verb, set "verb_forms" to null
- The three examples must show different usages or sentence structures — do not repeat the same pattern
- "contexts" must be chosen from: Business, Technology, Informal, Formal, Finance, Marketing, HR, Legal, Medicine, Slang, Academic, Literature, Sports, Travel
- "tip" should mention a common mistake learners make OR a trick to remember the word OR a nuance that distinguishes it from similar words

${LOCALE_INSTRUCTIONS[locale]}`

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

export function parseAIResponse(text: string): AIWordResponse {
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
