/* ============================================================
   IELTS PRO 150 — Netlify Function: Secure OpenRouter Proxy
   ------------------------------------------------------------
   The API key NEVER touches the browser. It lives in the
   Netlify environment variable:  OPENROUTER_API_KEY
   ============================================================ */

const ALLOWED_MODELS = new Set([
  /* — established models — */
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'anthropic/claude-3.5-sonnet',
  'google/gemini-flash-1.5',
  'deepseek/deepseek-chat',
  /* — new generation flash models — */
  'deepseek/deepseek-v4.1-flash',
  'google/gemini-3.8-flash',
  'qwen/qwen3.8-flash',
  'z-ai/glm-5.3-flash'
]);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const json = (status, obj) => ({ statusCode: status, headers: CORS, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  /* ---------- Preflight ---------- */
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')    return json(405, { error: 'Method not allowed. Use POST.' });

  /* ---------- Key check ---------- */
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return json(500, { error: 'Server not configured: set the OPENROUTER_API_KEY environment variable in Netlify.' });
  }

  /* ---------- Parse request ---------- */
  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON body.' }); }

  const { system, messages, model, temperature = 0.35, maxTokens = 3000 } = payload;

  if (!Array.isArray(messages) || messages.length === 0) {
    return json(400, { error: 'A non-empty "messages" array is required.' });
  }

  const safeModel = ALLOWED_MODELS.has(model) ? model : 'openai/gpt-4o-mini';

  const outbound = {
    model: safeModel,
    temperature: Math.min(Math.max(Number(temperature) || 0.35, 0), 1),
    max_tokens: Math.min(Math.max(Number(maxTokens) || 3000, 200), 8000),
    messages: system
      ? [{ role: 'system', content: String(system).slice(0, 12000) }, ...messages.slice(-12)]
      : messages.slice(-12)
  };

  /* ---------- Call OpenRouter ---------- */
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'https://ielts-pro-150.netlify.app',
        'X-Title': 'IELTS Pro 150'
      },
      body: JSON.stringify(outbound)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return json(res.status, { error: (data.error && data.error.message) || `OpenRouter error ${res.status}` });
    }

    return json(200, {
      content : (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '',
      model   : safeModel,
      usage   : data.usage || null
    });

  } catch (err) {
    return json(502, { error: 'Upstream request failed: ' + (err && err.message) });
  }
};