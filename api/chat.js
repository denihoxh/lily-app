/**
 * Lily Chat API
 * POST /api/chat
 *
 * Proxies chat messages to Groq/Llama server-side.
 * The GROQ_API_KEY env variable is set in Vercel — never exposed to the browser.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server not configured' });

  const { messages, system, max_tokens = 200 } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const fullMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages;

  try {
    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: fullMessages,
        max_tokens,
        temperature: 0.7
      })
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({ error: data.error?.message || 'Groq error' });
    }

    return res.status(200).json({
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
