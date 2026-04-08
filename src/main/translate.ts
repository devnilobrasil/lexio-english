// src/main/translate.ts
// Tradução direta de texto livre via Groq API — roda no main process

export async function translateText(text: string): Promise<string> {
  const apiKey = process.env.VITE_GROQ_API_KEY
  if (!apiKey) throw new Error('VITE_GROQ_API_KEY not set in environment')

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
