/* ============================================================
   IELTS PRO 150 — Utilities  (v2)
   DOM helpers · formatting · toasts · modals · speech · rings
   v2: ringSVG uses style="" attributes — SVG presentation
   attributes (stroke="var(--x)") are unreliable cross-browser.
   ============================================================ */

'use strict';

/* ---------- DOM ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------- Formatting ---------- */
function pad(n) { return String(n).padStart(2, '0'); }

function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

function uid() { return Math.random().toString(36).slice(2, 10); }

function todayISO(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function daysBetween(fromISO, toISO) {
  const a = new Date(fromISO + 'T00:00:00');
  const b = new Date(toISO + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ---------- Icons ---------- */
function icon(name, size = 20, cls = '') {
  return `<svg class="icon ${cls}" width="${size}" height="${size}" aria-hidden="true"><use href="#ic-${name}"></use></svg>`;
}

/* ---------- Deterministic shuffle (reproducible exams per day) ---------- */
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function seededShuffle(arr, seed) {
  const r = seededRandom(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- Band conversion ---------- */
function bandFromRaw(raw, scale) {
  const thresholds = Object.keys(scale).map(Number).sort((a, b) => b - a);
  for (const t of thresholds) if (raw >= t) return scale[t];
  return 0;
}

/* ---------- Toast ---------- */
function toast(msg, type = 'info', ms = 3400) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const icons = { info: 'info', success: 'check', error: 'alert', warn: 'alert' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `${icon(icons[type] || 'info', 18)}<span>${esc(msg)}</span>`;
  root.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 260); }, ms);
}

/* ---------- Modal ---------- */
const Modal = (() => {
  const root = () => document.getElementById('modal-root');

  function open({ title = '', body = '', footer = '', width = 560, onClose = null }) {
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = `
      <div class="modal" style="max-width:${width}px" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3 class="modal-title">${title}</h3>
          <button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div>`;
    root().appendChild(back);
    requestAnimationFrame(() => back.classList.add('show'));

    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      back.classList.remove('show');
      setTimeout(() => back.remove(), 200);
      if (onClose) onClose();
    }

    back.addEventListener('click', (e) => {
      if (e.target === back || e.target.closest('[data-close]')) close();
    });
    const onEsc = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); } };
    document.addEventListener('keydown', onEsc);

    return { el: back, close };
  }

  function confirmBox({ title = 'Are you sure?', message = '', okLabel = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      let settled = false;
      const m = open({
        title, width: 430,
        body: `<p class="confirm-msg">${message}</p>`,
        footer: `
          <button class="btn btn-ghost" data-cancel>Cancel</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okLabel)}</button>`,
        onClose: () => { if (!settled) { settled = true; resolve(false); } }
      });
      m.el.querySelector('[data-ok]').addEventListener('click', () => { settled = true; resolve(true); m.close(); });
      m.el.querySelector('[data-cancel]').addEventListener('click', () => { settled = true; resolve(false); m.close(); });
    });
  }

  return { open, confirm: confirmBox };
})();

/* ---------- SVG score ring (v2 — style-attr fix) ---------- */
function ringSVG(percent, { size = 120, stroke = 10, color = 'var(--accent)', label = '', sub = '' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = clamp(percent || 0, 0, 1);
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="ring" role="img">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
      style="stroke:var(--line)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
      style="stroke:${color}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - p)).toFixed(2)}"
      transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" text-anchor="middle" dy="${sub ? '-4' : '6'}"
      class="ring-label" font-size="${Math.round(size * 0.21)}">${esc(label)}</text>
    ${sub ? `<text x="50%" y="50%" text-anchor="middle" dy="18" class="ring-sub" font-size="${Math.round(size * 0.105)}">${esc(sub)}</text>` : ''}
  </svg>`;
}

/* ---------- File download ---------- */
function downloadFile(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
}

/* ---------- Text-to-speech (simple helper — the Listening module
   uses its own LAudio engine in data/listening-data.js) ---------- */
let _activeUtterance = null;

function speak(text, { rate = 0.95, pitch = 1, lang = 'en-GB' } = {}) {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) return reject(new Error('Speech synthesis not supported in this browser.'));
    stopSpeaking();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = lang; u.rate = rate; u.pitch = pitch;
    const voices = speechSynthesis.getVoices().filter(v => /^en[-_]/i.test(v.lang));
    const pick = voices.find(v => /GB/i.test(v.lang)) || voices[0];
    if (pick) u.voice = pick;
    u.onend = () => { _activeUtterance = null; resolve(); };
    u.onerror = (e) => { _activeUtterance = null; reject(e); };
    _activeUtterance = u;
    speechSynthesis.speak(u);
  });
}

function stopSpeaking() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  _activeUtterance = null;
}
