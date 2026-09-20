/* ============================================================
   IELTS PRO 150 — Vercel Serverless Function
   Secure OpenRouter proxy — mirrors the Netlify version.
   Set OPENROUTER_API_KEY in Vercel → Settings → Environment Variables.
   ============================================================ */

const ALLOWED_MODELS = new Set([
  'openai/gpt-4o-mini', 'openai/gpt-4o', 'anthropic/claude-3.5-sonnet',
  'google/gemini-flash-1.5', 'deepseek/deepseek-chat',
  'deepseek/deepseek-v4.1-flash', 'google/gemini-3.8-flash',
  'qwen/qwen3.8-flash', 'z-ai/glm-5.3-flash'
]);

export const maxDuration = 60;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server not configured: set OPENROUTER_API_KEY in Vercel environment variables.' });

  const { system, messages, model, temperature = 0.35, maxTokens = 3000 } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'A non-empty "messages" array is required.' });

  const outbound = {
    model: ALLOWED_MODELS.has(model) ? model : 'openai/gpt-4o-mini',
    temperature: Math.min(Math.max(Number(temperature) || 0.35, 0), 1),
    max_tokens: Math.min(Math.max(Number(maxTokens) || 3000, 200), 8000),
    messages: system
      ? [{ role: 'system', content: String(system).slice(0, 12000) }, ...messages.slice(-12)]
      : messages.slice(-12)
  };

  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'https://ielts-pro-150.vercel.app',
        'X-Title': 'IELTS Pro 150'
      },
      body: JSON.stringify(outbound)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: (data.error && data.error.message) || `OpenRouter error ${r.status}` });
    return res.status(200).json({
      content: (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '',
      model: outbound.model, usage: data.usage || null
    });
  } catch (err) {
    return res.status(502).json({ error: 'Upstream request failed: ' + (err && err.message) });
  }
}
