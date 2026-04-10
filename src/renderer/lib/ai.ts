// src/renderer/lib/ai.ts
import type { AIWordResponse, Locale } from '../../types'
import { invoke } from './tauri-bridge'

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
  'pt-BR': `- The "meaning" field inside each meanings entry must be written in natural Brazilian Portuguese, as a Brazilian would explain it to a friend — not a dictionary translation
- "meaning_short" must be a faithful word-for-word translation of "meaning_en" into Brazilian Portuguese — translate the exact same content, do not summarize
- "translation" in examples must sound natural in Brazilian Portuguese, not word-for-word
- Use Brazilian vocabulary and expressions, not European Portuguese`,
  'es': `- The "meaning" field inside each meanings entry must be written in natural Spanish, as a native speaker would explain it to a friend
- "meaning_short" must be a faithful word-for-word translation of "meaning_en" into Spanish — translate the exact same content, do not summarize
- "translation" in examples must sound natural in Spanish, not word-for-word`,
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
  "meanings": [
    {
      "context": "Brief context tag (e.g., General, Business, Computing, Slang, Phrasal Verb, Sports)",
      "meaning_en": "concise English definition in plain language, 1 sentence max",
      "meaning_short": "faithful word-for-word translation of meaning_en into ${LOCALE_NAMES[locale]} — translate the exact same content, do not summarize",
      "meaning": "clear and natural explanation in ${LOCALE_NAMES[locale]} — explain it like a knowledgeable friend would",
      "examples": [
        {
          "en": "natural, real-world sentence showing this specific meaning in context",
          "translation": "natural translation in ${LOCALE_NAMES[locale]}"
        }
      ]
    }
  ],
  "synonyms": ["3 to 5 genuinely interchangeable synonyms in common contexts"],
  "antonyms": ["1 to 3 antonyms if applicable, empty array if none"],
  "contexts": ["1 to 3 contexts where this word is most commonly used"]
}

Critical rules for "meanings":
- You MUST return between 2 and 5 distinct meanings. Think carefully: most common English words have multiple senses (e.g., "save" = rescue, store data, keep money, prevent a goal in sports, etc.). Do NOT collapse different senses into one entry.
- Each meaning must represent a genuinely different use of the word, not a rephrasing of the same idea.
- Each meaning MUST include at least 1 example. If the word has only 1–2 meanings, provide 2–3 examples per meaning to compensate.
- Examples must be real-world, practical sentences — not generic or textbook-style. Each example within a meaning must use a different sentence structure.
- Include common phrasal verbs as separate meanings if they are a primary way the word is used (e.g., "churn out", "save up", "run into").

Other rules:
- If the word is NOT a verb, set "verb_forms" to null
- "contexts" must be chosen from: Business, Technology, Informal, Formal, Finance, Marketing, HR, Legal, Medicine, Slang, Academic, Literature, Sports, Travel
${LOCALE_INSTRUCTIONS[locale]}`

export async function fetchWordFromGroq(word: string, locale: Locale): Promise<AIWordResponse> {
  const apiKey = await invoke<string | null>('get_api_key')
  if (!apiKey) throw new Error('API key not configured. Please set it in Settings.')

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
