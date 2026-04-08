// src/main/translate.ts
// Tradução direta de texto livre via Groq API — roda no main process

import { getApiKey } from './db'

export async function translateText(text: string): Promise<string> {
  const apiKey = getApiKey()
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
        {
          role: 'system',
          content: 'You are a professional translator. Translate the given text to English. Return ONLY the translated text, nothing else — no explanations, no notes, no quotes.',
        },
        {
          role: 'user',
          content: text,
        },
      ],
    }),
  })

  if (!response.ok) throw new Error(`Groq API error: ${response.status}`)

  const data = await response.json() as { choices: Array<{ message: { content: string } }> }
  const translated = data.choices?.[0]?.message?.content?.trim()
  if (!translated) throw new Error('Empty response from translation API')
  return translated
}
