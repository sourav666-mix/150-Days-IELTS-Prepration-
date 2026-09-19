/* ============================================================
   IELTS PRO 150 — AI Engine (OpenRouter)  v2
   Smart transport selection:
   • Local dev (`netlify dev`): fetches the server key once from
     the dev-only /api bridge and calls OpenRouter DIRECTLY from
     the browser — no local 30-second function cap, up to 120s
     per call. The key never appears in the UI or localStorage.
   • Production: no devkey endpoint exists (it answers 404), so
     all calls flow through the secure /api/openrouter proxy.
   • Manual override: a key pasted in Settings always forces the
     direct path (as before).
   Also: retry on transient proxy errors, robust JSON extraction,
   reusable "AI working" panel widget.
   ============================================================ */

'use strict';

const AI = (window.AI = (() => {

  const DIRECT_URL = 'https://openrouter.ai/api/v1/chat/completions';
  const DEVKEY_URL = '/.netlify/functions/devkey';

  /* ---------- dev-key bridge state ---------- */
  let devKey = null;
  let devKeyChecked = false;

  /* ---------- Settings ---------- */
  function currentModel() { return Store.getSetting('model', CONFIG.AI.DEFAULT_MODEL); }
  function localKey()     { return String(Store.getSetting('openrouterKey', '') || '').trim(); }

  /* Ask the dev-only bridge for the server key (404 in production) */
  async function getDevKey() {
    if (devKeyChecked) return devKey;
    devKeyChecked = true;
    try {
      const res = await fetch(DEVKEY_URL);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.key) devKey = String(data.key).trim() || null;
      }
    } catch { devKey = null; }
    return devKey;
  }

  async function resolveKey() {
    return localKey() || (await getDevKey());
  }

  /* ---------- Single raw call ---------- */
  async function callRaw({ system, messages, prompt, temperature = CONFIG.AI.TEMPERATURE,
                           maxTokens = CONFIG.AI.MAX_TOKENS, signal }) {
    if (!messages && prompt) messages = [{ role: 'user', content: String(prompt) }];
    if (!Array.isArray(messages) || !messages.length) throw new Error('No prompt provided to the AI engine.');

    const key = await resolveKey();
    const useDirect = !!key;
    const url = useDirect ? DIRECT_URL : CONFIG.AI.PROXY_URL;

    const headers = { 'Content-Type': 'application/json' };
    if (useDirect) headers.Authorization = 'Bearer ' + key;

    const msgs = system ? [{ role: 'system', content: String(system) }, ...messages] : messages;
    const body = useDirect
      ? { model: currentModel(), temperature, max_tokens: maxTokens, messages: msgs }
      : { model: currentModel(), temperature, maxTokens, system, messages };

    let res;
    try {
      res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      throw new Error('Network error — check your connection and try again.');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const raw = data.error && (data.error.message || data.error);
      const err = new Error(typeof raw === 'string' ? raw : 'AI service error (HTTP ' + res.status + ')');
      err.status = res.status;
      err.direct = useDirect;
      throw err;
    }

    const content = useDirect
      ? (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || ''
      : data.content || '';

    if (!content) throw new Error('The AI returned an empty response — please try again.');
    return content;
  }

  /* ---------- Public: request (timeout + smart retry) ----------
     • direct mode (dev / Settings key): single attempt, long
       120s budget — retries would just double a long wait.
     • proxy mode (production): one automatic retry on transient
       upstream errors (429/5xx).                                  */
  async function request(opts = {}) {
    const timeoutMs = opts.timeoutMs || 120000;

    const run = async () => {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), timeoutMs);
      try { return await callRaw({ ...opts, signal: ctrl.signal }); }
      finally { clearTimeout(to); }
    };

    try {
      return await run();
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('The AI took too long to respond. Please try again.');

      const canDirect = !!(localKey() || await getDevKey());
      if (!canDirect && e && e.status && [429, 500, 502, 503, 504].includes(e.status)) {
        await new Promise(r => setTimeout(r, 1200));
        return run();
      }
      throw e;
    }
  }

  /* ---------- Robust JSON extraction ---------- */
  function extractJSON(text) {
    let t = String(text == null ? '' : text).trim();

    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();

    const s = t.indexOf('{');
    const e = t.lastIndexOf('}');
    if (s === -1 || e === -1 || e <= s) throw new Error('The AI response could not be parsed as JSON. Please retry.');

    const cand = t.slice(s, e + 1);
    const tryParse = (x) => { try { return JSON.parse(x); } catch { return null; } };

    let obj = tryParse(cand);
    if (!obj) obj = tryParse(cand.replace(/,\s*([}\]])/g, '$1'));                                     // trailing commas
    if (!obj) obj = tryParse(cand.replace(/,\s*([}\]])/g, '$1')
                                      .replace(/[\u201C\u201D]/g, '"')
                                      .replace(/[\u2018\u2019]/g, "'"));                              // smart quotes
    if (!obj) throw new Error('The AI response could not be parsed as JSON. Please retry.');
    return obj;
  }

  async function requestJSON(opts) { return extractJSON(await request(opts)); }

  /* ---------- Reusable "AI working" panel ---------- */
  function panel(host, title = 'AI Examiner') {
    const el = document.createElement('div');
    el.className = 'ai-panel';
    el.innerHTML = `
      <div class="ai-panel-head">
        ${icon('spark', 22)}
        <h3>${esc(title)}</h3>
        <span class="badge badge-gold">working…</span>
      </div>
      <div class="ai-working">
        <span class="spinner"></span>
        <span class="status-line">Preparing request…</span>
      </div>
      <div class="ai-result" hidden></div>`;
    host.appendChild(el);

    const working  = el.querySelector('.ai-working');
    const statusEl = el.querySelector('.status-line');
    const resultEl = el.querySelector('.ai-result');
    const badge    = el.querySelector('.badge');
    let finished = false;

    return {
      el,
      setStatus(msg) { if (!finished && statusEl) statusEl.textContent = msg; },
      finish(html) {
        finished = true;
        working.hidden = true;
        resultEl.hidden = false;
        resultEl.innerHTML = html;
        badge.textContent = 'complete';
        badge.className = 'badge badge-green';
      },
      fail(msg) {
        finished = true;
        working.hidden = true;
        resultEl.hidden = false;
        resultEl.innerHTML = `
          <div class="fb-block">
            <h4>${icon('alert', 16)} Analysis unavailable</h4>
            <p>${esc(msg)}</p>
            <p class="hint">Check that OPENROUTER_API_KEY is set on Netlify — or paste a dev key in Settings (local use only).</p>
          </div>`;
        badge.textContent = 'error';
        badge.className = 'badge badge-red';
      }
    };
  }

  return {
    request, requestJSON, extractJSON, panel,
    currentModel, localKey,
    usingDirect: async () => !!(localKey() || await getDevKey())
  };
})());