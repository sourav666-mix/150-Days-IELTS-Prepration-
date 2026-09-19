/* ============================================================
   IELTS PRO 150 — boot.js  (v3 — final)
   Theme · header meta · hash router (7 routes, error-safe) ·
   settings incl. Exam Preferences. Feature modules register
   into window.Views BEFORE this file loads.
   ============================================================ */

'use strict';

(function () {

  const Views = (window.Views = window.Views || {});

  /* ================= THEME ================= */
  const mediaDark = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme(mode) {
    const resolved = mode === 'auto' ? (mediaDark.matches ? 'dark' : 'light') : mode;
    document.documentElement.dataset.theme = resolved;
    const btn = $('#themeToggle');
    if (btn) btn.innerHTML = icon(resolved === 'dark' ? 'sun' : 'moon', 19);
  }

  mediaDark.addEventListener('change', () => {
    if (Store.getSetting('theme', 'auto') === 'auto') applyTheme('auto');
  });

  /* ================= HEADER META ================= */
  function renderHeaderMeta() {
    const p = Store.getProgress();
    const st = Store.stats();
    const phase = StudyPlan.getPhase(p.currentDay);

    const dayPill = $('#dayPill');
    const streakPill = $('#streakPill');
    if (dayPill) dayPill.textContent = `Day ${p.currentDay} / ${CONFIG.TOTAL_DAYS}`;
    if (streakPill) streakPill.textContent = st.streak;

    const fill = $('#side-progress-fill');
    const pct = $('#side-percent');
    const label = $('#side-day-label');
    if (fill) fill.style.width = st.overallPercent + '%';
    if (pct) pct.textContent = st.overallPercent + '%';
    if (label) label.textContent = `Day ${p.currentDay} of ${CONFIG.TOTAL_DAYS} · ${phase.name}`;
  }
  window.refreshHeaderMeta = renderHeaderMeta;

  /* ================= ROUTER ================= */
  const ROUTES = ['dashboard', 'reading', 'writing', 'listening', 'progress', 'review', 'mock'];

  const Router = {
    current() {
      const h = location.hash.replace(/^#\/?/, '');
      return ROUTES.includes(h) ? h : 'dashboard';
    },
    go(name) { location.hash = '#/' + name; },
    handle() {
      const name = this.current();

      $$('.view').forEach(v => v.classList.remove('active'));
      const el = document.getElementById('view-' + name);
      if (!el) return;
      el.classList.add('active');

      $$('[data-view]').forEach(a => a.classList.toggle('active', a.dataset.view === name));
      window.scrollTo({ top: 0 });

      if (Views[name] && typeof Views[name].mount === 'function') {
        try {
          Views[name].mount(el);
        } catch (err) {
          console.error('[view:' + name + ']', err);
          el.innerHTML = `<div class="empty-state">${icon('alert', 44)}
            <h3>Something went wrong</h3>
            <p>${esc(err.message || 'Unexpected error')} — please reload the page.</p></div>`;
        }
      } else {
        el.innerHTML = `<div class="empty-state">${icon('info', 44)}
          <h3>Coming soon</h3><p>This module ships in a later build batch.</p></div>`;
      }
    }
  };
  window.Router = Router;

  /* ================= SETTINGS MODAL ================= */
  function openSettings() {
    const s = Store.getSettings();
    const modelOpts = CONFIG.AI.MODELS
      .map(m => `<option value="${m.id}" ${m.id === s.model ? 'selected' : ''}>${esc(m.label)}</option>`).join('');
    const themeSeg = ['light', 'dark', 'auto']
      .map(t => `<button class="seg-btn ${s.theme === t ? 'active' : ''}" data-theme-set="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('');

    const m = Modal.open({
      title: 'Settings',
      width: 580,
      body: `
        <div class="field">
          <label class="label">Appearance</label>
          <div class="seg">${themeSeg}</div>
        </div>
        <div class="field">
          <label class="label" for="set-model">AI examiner model (OpenRouter)</label>
          <select id="set-model" class="select">${modelOpts}</select>
          <p class="hint">Used for reading analysis, essay scoring, test generation and answer keys.</p>
        </div>
        <div class="field">
          <label class="label" for="set-key">OpenRouter API key <span class="muted">(optional — local development only)</span></label>
          <input id="set-key" type="password" class="input" placeholder="sk-or-v1-…" value="${esc(s.openrouterKey || '')}" autocomplete="off">
          <p class="hint">On Netlify the key is stored securely in the serverless function — leave this empty in production.</p>
        </div>
        <div class="field">
          <label class="label">Exam preferences</label>
          <label class="switch-row"><span>Strict audio — each recording plays once per Listening visit</span>
            <span class="switch"><input type="checkbox" id="set-strict-audio" ${s.strictAudio ? 'checked' : ''}><i></i></span></label>
          <label class="switch-row"><span>Hide pause buttons in practice exams</span>
            <span class="switch"><input type="checkbox" id="set-strict-pause" ${s.strictPause ? 'checked' : ''}><i></i></span></label>
          <p class="hint">During a Mock Exam, pausing is always disabled and timing is enforced.</p>
        </div>
        <div class="field-row">
          <button class="btn btn-ghost" id="set-export">${icon('download', 16)} Export my data</button>
          <button class="btn btn-danger-ghost" id="set-reset">${icon('trash', 16)} Reset all progress</button>
        </div>
        <p class="hint center" style="margin-top:18px">${esc(CONFIG.APP_NAME)} · v${CONFIG.APP_VERSION} · Target Band ${CONFIG.TARGET_BAND}.0 · No account required</p>`,
      footer: `<button class="btn btn-primary" id="set-done">Done</button>`
    });

    $$('[data-theme-set]', m.el).forEach(b => b.addEventListener('click', () => {
      Store.setSetting('theme', b.dataset.themeSet);
      applyTheme(b.dataset.themeSet);
      $$('[data-theme-set]', m.el).forEach(x => x.classList.toggle('active', x === b));
    }));

    $('#set-model', m.el).addEventListener('change', e => Store.setSetting('model', e.target.value));
    $('#set-key', m.el).addEventListener('change', e => Store.setSetting('openrouterKey', e.target.value.trim()));

    $('#set-strict-audio', m.el).addEventListener('change', e => {
      Store.setSetting('strictAudio', e.target.checked);
      toast('Strict audio ' + (e.target.checked ? 'enabled — recordings play once per visit.' : 'disabled.'), 'info', 2600);
    });
    $('#set-strict-pause', m.el).addEventListener('change', e => {
      Store.setSetting('strictPause', e.target.checked);
      if (window.ExamPrefs) ExamPrefs.apply();
    });

    $('#set-export', m.el).addEventListener('click', () => {
      downloadFile(`ielts-pro-150-backup-${todayISO()}.json`, JSON.stringify(Store.exportData(), null, 2));
      toast('Progress exported.', 'success');
    });

    $('#set-reset', m.el).addEventListener('click', async () => {
      const ok = await Modal.confirm({
        title: 'Reset everything?',
        message: 'This permanently deletes all 150-day progress, scores, streaks, drafts and mock history on this device. This cannot be undone.',
        okLabel: 'Delete everything', danger: true
      });
      if (ok) {
        Store.resetAll();
        try { localStorage.removeItem(CONFIG.STORAGE_PREFIX + 'mock'); } catch (e) {}
        if (window.ExamPrefs) ExamPrefs.apply();
        m.close(); renderHeaderMeta(); Router.handle(); toast('All progress reset.', 'warn');
      }
    });

    $('#set-done', m.el).addEventListener('click', () => m.close());
  }

  /* ================= INIT ================= */
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(Store.getSetting('theme', 'auto'));
    renderHeaderMeta();

    $('#themeToggle').addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme;
      const next = cur === 'dark' ? 'light' : 'dark';
      Store.setSetting('theme', next);
      applyTheme(next);
    });

    $('#settingsBtn').addEventListener('click', openSettings);

    window.addEventListener('hashchange', () => Router.handle());
    Router.handle();
  });

})();