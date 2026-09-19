/* ============================================================
   IELTS PRO 150 — Reading Module  (v2 — fixed)
   Flow: prep → (AI generate | builtin) → intro → exam
         (60-min timer · pause · autosave · navigator)
         → submit → results + AI deep analysis → re-practice
   Fixes in v2: loadTest() defined (built-in button crashed),
   TFNG/YNNG instruction headers now render, autosave interval
   leak on remount, live counter while typing, idempotent
   generation-step renderer with retry notes, cleanup of dead code.
   ============================================================ */

'use strict';

window.Views = window.Views || {};

(function () {

  let S = null;   // current session state

  /* ==========================================================
     Helpers
     ========================================================== */
  const TYPE_LABEL = {
    tfng: 'True · False · Not Given', ynng: 'Yes · No · Not Given',
    mcq: 'Multiple Choice', heading: 'Matching Headings',
    info: 'Matching Information', ending: 'Matching Sentence Endings',
    fill: 'Completion', short: 'Short-Answer Questions'
  };
  const TYPE_INSTRUCTION = {
    tfng: 'Do the following statements agree with the information given in the passage? Choose TRUE if the statement agrees with the information, FALSE if it contradicts it, NOT GIVEN if there is no information about it.',
    ynng: 'How does the writer address the following? Choose YES if the statement reflects the writer\u2019s claims, NO if it contradicts them, NOT GIVEN if the writer makes no such claim.',
    mcq: 'Choose the correct letter, A, B, C or D.',
    fill: 'Complete the sentences/summary with words from the passage.',
    short: 'Answer the questions with words from the passage.',
    heading: 'Choose the correct heading for each paragraph from the list of headings.',
    info: 'Which paragraph contains the following information?',
    ending: 'Choose the correct ending for each sentence.'
  };

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().trim()
      .replace(/\s+/g, ' ').replace(/[.!,;:]+$/, '');
  }
  function stripArticles(s) { return norm(s).replace(/\b(the|a|an)\s+/g, ' ').replace(/\s+/g, ' ').trim(); }

  function isCorrect(q, ans) {
    if (ans == null || String(ans).trim() === '') return false;
    const u = norm(ans);
    const keys = Array.isArray(q.answer) ? q.answer : [q.answer];
    return keys.some(k => norm(k) === u || stripArticles(k) === stripArticles(u));
  }

  function unansweredCount() {
    return S.test.parts.reduce((sum, p) =>
      sum + p.questions.filter(q => S.answers[q.n] == null || String(S.answers[q.n]).trim() === '').length, 0);
  }

  function draftWrite(extra) {
    Store.saveDraft(S.day, 'reading', Object.assign({
      status: S.phase, test: S.test, answers: S.answers,
      flags: Array.from(S.flags), remaining: S.timer ? S.timer.remaining : CONFIG.READING_DURATION
    }, extra || {}));
  }

  /* ==========================================================
     Load a chosen test into the session and show the intro
     ========================================================== */
  function loadTest(test, phase) {
    S.test = test;
    S.answers = {};
    S.flags = new Set();
    S.phase = phase;
    S.result = null;
    draftWrite();
    introScreen(document.getElementById('view-reading'));
  }

  /* ==========================================================
     1 · PREP SCREEN
     ========================================================== */
  function prepScreen(el) {
    const plan = S.plan;
    el.innerHTML = `
      <span class="kicker">Day ${plan.day} · Reading · 60 minutes</span>
      <h1 class="page-title">IELTS Academic Reading</h1>
      <p class="page-sub">Three passages · 40 questions · ${CONFIG.READING.MIN_TOTAL_WORDS.toLocaleString()}–${CONFIG.READING.MAX_TOTAL_WORDS.toLocaleString()} words.
      Today's topic: <strong>${esc(plan.reading.topic)}</strong>.</p>

      <div class="blueprint">
        <span class="chip">${icon('clock', 15)} 60-minute countdown</span>
        <span class="chip">${icon('book', 15)} 3 passages</span>
        <span class="chip">${icon('list', 15)} 40 questions · all official types</span>
        <span class="chip">${icon('spark', 15)} AI deep analysis + answer key</span>
        <span class="chip">${icon('refresh', 15)} Re-practice after submit</span>
      </div>

      <div class="card card-pad-lg" style="max-width:640px">
        <h3 style="font-family:var(--font-head); margin-bottom:8px">Choose your test paper</h3>
        <p style="font-size:14px; color:var(--ink-2)">
          <strong>Option A — AI-generated paper:</strong> Examiner Ada writes a brand-new, full-length 3-passage test on today's topic
          (<em>${esc(plan.reading.topic)}</em>) with questions, structure and an official answer key. Takes ~1–2 minutes and needs an API key.
        </p>
        <p style="font-size:14px; color:var(--ink-2); margin-top:10px">
          <strong>Option B — built-in paper:</strong> a complete offline practice test (The Story of Silk · Printing the Human Body · The Hunt for Alien Worlds, ≈2,250 words).
        </p>
        <div class="source-row">
          <button class="btn btn-primary btn-lg" id="genBtn">${icon('spark', 17)} Generate AI test on today's topic</button>
          <button class="btn btn-ghost btn-lg" id="builtinBtn">${icon('book', 17)} Use built-in test</button>
        </div>
        <div id="genHost" class="gen-steps" style="margin-top:18px"></div>
      </div>`;

    $('#builtinBtn', el).addEventListener('click', () => {
      const t = ReadingBank.builtin();
      if (!t) { toast('Built-in test is unavailable.', 'error'); return; }
      loadTest(t, 'intro');
    });

    $('#genBtn', el).addEventListener('click', () => runGeneration(el));
  }

  async function runGeneration(el) {
    const host = $('#genHost', el);
    const btn = $('#genBtn', el);
    btn.disabled = true;
    const steps = [
      'Passage 1 — text + questions + key',
      'Passage 2 — text + questions + key',
      'Passage 3 — text + questions + key',
      'Assembling & validating the paper'
    ];
    host.innerHTML = steps.map((s, i) => `
      <div class="gen-step" data-step="${i}">
        <span class="gs-ico">${icon('clock', 16)}</span><span data-base="${esc(s)}">${esc(s)}</span>
      </div>`).join('') + `<p class="hint" style="margin-top:6px">Generating with ${esc(AI.currentModel())} — please keep this tab open.</p>`;

    /* Idempotent: safe to set "active" again on retries (spinner
       and note are rebuilt, never duplicated). */
    const setStep = (i, state, note) => {
      const n = host.querySelector(`[data-step="${i}"]`);
      if (!n) return;
      const textSpan = n.querySelector('span:last-child');
      const base = textSpan.dataset.base || textSpan.textContent;
      n.className = 'gen-step ' + (state === 'active' ? 'active' : state === 'done' ? 'done' : state === 'error' ? 'error' : '');
      n.querySelector('.gs-ico').innerHTML = icon(state === 'done' ? 'check' : state === 'error' ? 'x' : 'clock', 16);
      const old = textSpan.querySelector('.spinner');
      if (old) old.remove();
      textSpan.textContent = base + (note ? ` (${note})` : '');
      if (state === 'active') {
        textSpan.insertAdjacentHTML('beforeend', ' <span class="spinner" style="width:14px;height:14px;border-width:2px"></span>');
      }
    };

    try {
      const test = await ReadingBank.gen(S.plan, { onStep: setStep });
      toast('AI test ready — good luck!', 'success');
      loadTest(test, 'intro');
    } catch (e) {
      btn.disabled = false;
      host.insertAdjacentHTML('beforeend', `
        <div class="fb-block" style="border:none; padding-top:10px">
          <p style="color:var(--danger); font-weight:600">${icon('alert', 15)} ${esc(e.message || 'Generation failed.')}</p>
          <p class="hint">You can retry, or use the built-in test below. ${AI.localKey() ? '' : 'Tip: set OPENROUTER_API_KEY on Netlify (or a dev key in Settings) to enable generation.'}</p>
        </div>`);
    }
  }

  /* ==========================================================
     2 · INTRO (test overview → Start button starts the timer)
     ========================================================== */
  function introScreen(el) {
    const t = S.test;
    const wcOk = t.words >= CONFIG.READING.MIN_TOTAL_WORDS && t.words <= CONFIG.READING.MAX_TOTAL_WORDS;
    const wcCls = wcOk ? 'wordcount-ok' : 'wordcount-warn';

    el.innerHTML = `
      <span class="kicker">Day ${S.plan.day} · Reading</span>
      <h1 class="page-title">Your test is ready</h1>
      <p class="page-sub">${t.source === 'ai' ? 'Freshly generated by Examiner Ada' : 'Built-in practice paper'} — check the overview, then start the 60-minute countdown.</p>

      <div class="overview-grid">
        ${t.parts.map((p, i) => `
          <div class="overview-card">
            <strong>Passage ${i + 1}</strong>
            <span>${esc(p.title)}</span><br>
            <span class="muted">${p.paragraphs.length} paragraphs · ${ReadingBank.wc(p.paragraphs.map(x => x.text).join(' '))} words · Q${p.questions[0].n}–${p.questions[p.questions.length - 1].n}</span>
          </div>`).join('')}
      </div>

      <div class="card" style="display:flex; gap:20px; align-items:center; flex-wrap:wrap">
        <div class="stat-icon navy">${icon('file', 22)}</div>
        <div style="flex:1; min-width:220px">
          <strong style="font-family:var(--font-head)">Total length: <span class="${wcCls}">${t.words.toLocaleString()} words</span></strong>
          <p class="hint">${wcOk ? 'Within the official 2,150–2,750 range.' : 'Slightly outside the official 2,150–2,750 range — still full-length practice.'}</p>
        </div>
        <span class="badge badge-navy">${t.totalQuestions} questions</span>
      </div>

      <div class="exam-actions">
        <button class="btn btn-primary btn-lg" id="startExam">${icon('play', 17)} Start the 60-minute timer</button>
        <button class="btn btn-ghost" id="regen">${icon('refresh', 16)} Choose another paper</button>
      </div>`;

    $('#startExam', el).addEventListener('click', () => { S.phase = 'exam'; startExam(el); });
    $('#regen', el).addEventListener('click', () => { Store.clearDraft(S.day, 'reading'); mount(el); });
  }

  /* ==========================================================
     3 · EXAM
     ========================================================== */
  function startExam(el, resumeRemaining) {
    buildExamUI(el);
    S.timer = new ExamTimer({
      duration: CONFIG.READING_DURATION,
      displayEl: $('#rd-timer', el),
      barEl: $('#rd-bar', el),
      wrapEl: $('#rd-timerwrap', el),
      checkpoints: CONFIG.READING.CHECKPOINTS,
      onWarning: (sec) => toast(`${fmtTime(sec)} remaining in the Reading test.`, sec <= 60 ? 'error' : 'warn', 2600),
      onExpire: () => { toast('Time is up — your paper has been submitted automatically.', 'warn', 5000); submit(true); }
    });
    if (resumeRemaining != null) {
      S.timer.remaining = Math.max(1, resumeRemaining);
      S.timer._render();
    }
    S.timer.start();
    S.autosave = setInterval(() => { if (S.phase === 'exam' && !S.timer.paused) draftWrite(); }, 8000);
    draftWrite();
  }

  function buildExamUI(el) {
    el.innerHTML = `
      <div class="exam-bar" id="rd-timerwrap">
        <div class="timer-display clickable" id="rd-clock" title="Click to pause / resume the timer">${icon('clock', 21)}<span id="rd-timer">${fmtTime(CONFIG.READING_DURATION)}</span></div>
        <div class="progressbar"><div class="progressbar-fill" id="rd-bar"></div></div>
        <span class="pill" id="rd-count">0 / 40 answered</span>
        <button class="btn btn-sm btn-ghost" id="rd-pause">${icon('pause', 14)} Pause</button>
        <button class="btn btn-sm btn-primary" id="rd-submit">${icon('check', 14)} Submit test</button>
      </div>

      <div class="rs-mobile-toggle">
        <button class="seg-btn active" data-mode="passage">Passages</button>
        <button class="seg-btn" data-mode="questions">Questions</button>
      </div>

      <div class="reading-split" id="rd-split">
        <div class="passage-pane">
          <div class="rs-tabs" id="rd-tabs">
            ${S.test.parts.map((p, i) => `<button class="rs-tab ${i === 0 ? 'active' : ''}" data-part="${i}">Passage ${i + 1}</button>`).join('')}
          </div>
          <div class="card" id="rd-passage"></div>
        </div>
        <div class="questions-pane">
          <div id="rd-questions"></div>
          <div class="card" id="rd-navcard" style="margin-top:4px">
            <h4 style="font-family:var(--font-head); font-size:14px; margin-bottom:10px">Question Navigator</h4>
            <div class="qgrid" id="rd-nav"></div>
            <p class="hint" style="margin-top:10px">Green = answered · outline = flagged · click to jump.</p>
          </div>
          <div class="exam-actions">
            <button class="btn btn-primary btn-lg btn-block" id="rd-submit2">${icon('check', 16)} Submit test &amp; get AI analysis</button>
          </div>
        </div>
      </div>`;

    renderPassage(0);
    renderQuestions();

    /* tabs */
    $('#rd-tabs', el).addEventListener('click', (e) => {
      const b = e.target.closest('[data-part]');
      if (!b) return;
      $$('#rd-tabs .rs-tab', el).forEach(x => x.classList.toggle('active', x === b));
      renderPassage(Number(b.dataset.part));
    });

    /* mobile mode */
    $$('.rs-mobile-toggle .seg-btn', el).forEach(b => b.addEventListener('click', () => {
      $$('.rs-mobile-toggle .seg-btn', el).forEach(x => x.classList.toggle('active', x === b));
      $('#rd-split', el).className = 'reading-split mode-' + b.dataset.mode;
      if (b.dataset.mode === 'questions') window.scrollTo({ top: 0 });
    }));

    /* pause — via the button or by clicking the timer clock */
    function togglePause() {
      const t = S.timer;
      if (t.expired) return;
      if (t.paused) { t.resume(); toast('Timer resumed.', 'info', 1500); }
      else { t.pause(); draftWrite(); toast('Paused — the countdown is stopped.', 'warn', 2200); }
      $('#rd-pause', el).innerHTML = t.paused ? `${icon('play', 14)} Resume` : `${icon('pause', 14)} Pause`;
    }
    $('#rd-pause', el).addEventListener('click', togglePause);
    $('#rd-clock', el).addEventListener('click', () => {
      /* mock days / strict-pause preference allow no pausing */
      if (document.body.hasAttribute('data-mock') || document.body.hasAttribute('data-strict-pause')) return;
      togglePause();
    });

    /* answers — change fires for radios/selects and text-on-blur */
    $('#rd-questions', el).addEventListener('change', (e) => {
      const inp = e.target;
      const n = Number(inp.dataset.q);
      if (!n) return;
      S.answers[n] = inp.type === 'radio' ? inp.value : inp.value.trim();
      if (inp.type === 'radio') {
        $$(`input[name="${inp.name}"]`).forEach(r => r.closest('.opt').classList.toggle('checked', r.checked));
      }
      refreshCounts(el);
      draftWrite();
    });
    /* live counter while typing in text inputs (no re-render) */
    $('#rd-questions', el).addEventListener('input', (e) => {
      const inp = e.target;
      if (!inp.matches || !inp.matches('input[type="text"]')) return;
      const n = Number(inp.dataset.q);
      if (!n) return;
      S.answers[n] = inp.value.trim();
      const c = $('#rd-count', el);
      if (c) c.textContent = `${40 - unansweredCount()} / 40 answered`;
    });

    /* flags */
    $('#rd-questions', el).addEventListener('click', (e) => {
      const fb = e.target.closest('.flag-btn');
      if (!fb) return;
      const n = Number(fb.dataset.flag);
      if (S.flags.has(n)) S.flags.delete(n); else S.flags.add(n);
      fb.classList.toggle('on', S.flags.has(n));
      fb.innerHTML = icon('star', 15);
      refreshNav();
      draftWrite();
    });

    /* navigator jump */
    $('#rd-nav', el).addEventListener('click', (e) => {
      const d = e.target.closest('.qdot');
      if (!d) return;
      const target = document.getElementById('q-' + d.dataset.q);
      if (target) {
        if (window.innerWidth <= 960) {
          $$('.rs-mobile-toggle .seg-btn', el).forEach(x => x.classList.toggle('active', x.dataset.mode === 'questions'));
          $('#rd-split', el).className = 'reading-split mode-questions';
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.style.transition = 'box-shadow .4s';
        target.style.boxShadow = '0 0 0 3px var(--accent-soft)';
        setTimeout(() => { target.style.boxShadow = ''; }, 900);
      }
    });

    /* submit */
    $('#rd-submit', el).addEventListener('click', confirmSubmit);
    $('#rd-submit2', el).addEventListener('click', confirmSubmit);

    refreshCounts(el);
  }

  function renderPassage(i) {
    const p = S.test.parts[i];
    $('#rd-passage').innerHTML = `
      <h2 class="passage-title">${esc(p.title)}</h2>
      <p class="hint passage-meta">READING PASSAGE ${i + 1} · ${ReadingBank.wc(p.paragraphs.map(x => x.text).join(' '))} words</p>
      <div class="passage-body">
        ${p.paragraphs.map(par => `<p><span class="para-letter">${esc(par.letter)}</span>${esc(par.text)}</p>`).join('')}
      </div>`;
  }

  /* ---------- question rendering ---------- */
  function groupBlock(q) {
    const g = q.group;
    if (!g) return '';
    let inner = '';
    if (g.pool) {
      if (q.type === 'info') {
        const labels = g.pool.map(op => typeof op === 'string' ? op : (op && op.label) || '').filter(Boolean);
        inner = `<h5>${esc(g.title || 'Paragraphs')}</h5><p><span class="pool-label">${esc(labels.join(' · '))}</span></p>`;
      } else {
        inner = `<h5>${esc(g.title || 'Options')}</h5><ol>` + g.pool.map(op => {
          if (typeof op === 'string') return `<li><span class="pool-label">${esc(op)}</span></li>`;
          return `<li><span class="pool-label">${esc(op.label)}</span> ${esc(op.text)}</li>`;
        }).join('') + '</ol>';
      }
    } else if (g.text) {
      inner = `<h5>${esc(g.title || '')}</h5><p class="pool-summary-text">${esc(g.text)}</p>`;
    } else if (g.title) {
      inner = `<h5>${esc(g.title)}</h5>`;
    }
    return `<div class="pool-card">${inner}</div>`;
  }

  /* Identifies the "block" a question belongs to so each block's
     instruction header renders exactly once. TFNG/YNNG statements
     have no group object — they get an implicit key by type.
     (Fixes the v1 bug where their instruction never appeared.) */
  function groupKey(q) {
    if (q.type === 'tfng' || q.type === 'ynng') return q.type + ':statements';
    if (q.group && typeof q.group === 'object') {
      const g = q.group;
      const id = g.title ||
        (g.pool ? (typeof g.pool[0] === 'string' ? g.pool[0] : (g.pool[0] && g.pool[0].label) || '') : '') || 'g';
      return q.type + ':' + id;
    }
    return q.type + ':none';
  }

  function questionHTML(q, prevKey) {
    const key = groupKey(q);
    const needsHead = key !== prevKey;

    let head = '';
    if (needsHead) {
      head = `
        <div class="q-group-head">
          <span class="q-range">Question ${q.n}</span> · <span class="q-type">${TYPE_LABEL[q.type]}</span>
          <p>${esc(TYPE_INSTRUCTION[q.type] || '')}</p>
        </div>${groupBlock(q)}`;
    }

    let body = '';
    if (q.type === 'tfng' || q.type === 'ynng') {
      const opts = q.type === 'tfng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN'];
      body = `<div class="opts">${opts.map(o => `
        <label class="opt ${S.answers[q.n] === o ? 'checked' : ''}">
          <input type="radio" name="q${q.n}" data-q="${q.n}" value="${o}" ${S.answers[q.n] === o ? 'checked' : ''}>
          <span>${o}</span>
        </label>`).join('')}</div>`;
    } else if (q.type === 'mcq') {
      body = `<div class="opts">${(q.options || []).map(o => `
        <label class="opt ${S.answers[q.n] === o.label ? 'checked' : ''}">
          <input type="radio" name="q${q.n}" data-q="${q.n}" value="${esc(o.label)}" ${S.answers[q.n] === o.label ? 'checked' : ''}>
          <span class="opt-letter">${esc(o.label)}</span><span>${esc(o.text)}</span>
        </label>`).join('')}</div>`;
    } else if (['heading', 'info', 'ending'].includes(q.type)) {
      const pool = (q.group && q.group.pool) || [];
      const cur = S.answers[q.n] || '';
      body = `<div class="blank-row">
        <select class="select match-select" data-q="${q.n}">
          <option value="">— choose —</option>
          ${pool.map(op => {
            const v = typeof op === 'string' ? op : op.label;
            const lbl = typeof op === 'string' ? op : op.label + (op.text ? ' — ' + op.text : '');
            return `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(lbl)}</option>`;
          }).join('')}
        </select>
        ${q.allow ? `<span class="constraint-badge">${esc(q.allow)}</span>` : ''}
      </div>`;
    } else { /* fill / short */
      body = `<div class="blank-row">
        <input type="text" class="input blank-input" data-q="${q.n}" value="${esc(S.answers[q.n] || '')}" autocomplete="off" spellcheck="false">
        ${q.allow ? `<span class="constraint-badge">${esc(q.allow)}</span>` : ''}
      </div>`;
    }

    const flagged = S.flags.has(q.n);
    return `${head}
      <div class="q-item" id="q-${q.n}">
        <span class="q-num">${q.n}</span>
        <div class="q-body">
          <p class="q-prompt">${esc(q.prompt)}</p>
          ${body}
        </div>
        <button class="flag-btn ${flagged ? 'on' : ''}" data-flag="${q.n}" title="Flag for review">${icon('star', 15)}</button>
      </div>`;
  }

  function renderQuestions() {
    const host = $('#rd-questions');
    if (!host || !S.test) return;
    let html = '', prevKey = null;

    S.test.parts.forEach((p, pi) => {
      const first = p.questions[0].n, last = p.questions[p.questions.length - 1].n;
      html += `
        <div class="q-group">
          <div class="q-group-head">
            <span class="q-range">Questions ${first}–${last}</span>
            <p>Reading Passage ${pi + 1} — <strong>${esc(p.title)}</strong></p>
          </div>
          <div class="q-list">`;
      p.questions.forEach((q, qi) => {
        html += questionHTML(q, qi === 0 ? null : prevKey);
        prevKey = groupKey(q);
      });
      html += `</div></div>`;
    });

    host.innerHTML = html;
    refreshNav();
  }

  /* ---------- counts / navigator ---------- */
  function refreshCounts(el) {
    const done = 40 - unansweredCount();
    const c = $('#rd-count', el || document);
    if (c) c.textContent = `${done} / 40 answered`;
    refreshNav();
  }

  function refreshNav() {
    const nav = $('#rd-nav');
    if (!nav || !S || !S.test) return;
    const all = [];
    S.test.parts.forEach(p => p.questions.forEach(q => all.push(q)));
    nav.innerHTML = all.map(q => {
      const ans = S.answers[q.n] != null && String(S.answers[q.n]).trim() !== '';
      const cls = [ans ? 'answered' : '', S.flags.has(q.n) ? 'flagged' : ''].join(' ');
      return `<button class="qdot ${cls}" data-q="${q.n}">${q.n}</button>`;
    }).join('');
  }

  /* ==========================================================
     4 · SUBMIT → RESULTS (+ AI deep analysis)
     ========================================================== */
  async function confirmSubmit() {
    if (S.submitting) return;
    const un = unansweredCount();
    const ok = await Modal.confirm({
      title: 'Submit your Reading paper?',
      message: un > 0
        ? `You have <strong>${un} unanswered question${un === 1 ? '' : 's'}</strong>. Unanswered questions score zero. Submit anyway?`
        : 'All 40 questions are answered. Submit and run the AI examiner\u2019s deep analysis?',
      okLabel: un > 0 ? 'Submit anyway' : 'Submit & analyse',
      danger: un > 20
    });
    if (ok) submit(false);
  }

  function localMark() {
    const rows = [];
    let correct = 0;
    S.test.parts.forEach(p => p.questions.forEach(q => {
      const ua = S.answers[q.n];
      const answered = ua != null && String(ua).trim() !== '';
      const ok = answered && isCorrect(q, ua);
      if (ok) correct++;
      rows.push({ q: q.n, type: q.type, prompt: q.prompt, yourAnswer: answered ? String(ua) : '', correctAnswer: Array.isArray(q.answer) ? q.answer[0] : q.answer, verdict: !answered ? 'unanswered' : ok ? 'correct' : 'incorrect', explanation: '' });
    }));
    const raw = correct;
    return {
      raw,
      band: bandFromRaw(raw, CONFIG.READING_BAND_SCALE),
      correct, incorrect: rows.filter(r => r.verdict === 'incorrect').length,
      unanswered: rows.filter(r => r.verdict === 'unanswered').length,
      review: rows
    };
  }

  function cleanupExam() {
    if (S.autosave) { clearInterval(S.autosave); S.autosave = null; }
    if (S.timer) S.timer.pause();
  }

  async function submit(auto) {
    if (S.submitting || S.phase !== 'exam') return;
    S.submitting = true;
    cleanupExam();

    const minutesUsed = Math.round((CONFIG.READING_DURATION - S.timer.remaining) / 60);
    const res = localMark();
    res.auto = !!auto;
    res.minutesUsed = minutesUsed;
    res.model = AI.currentModel();
    res.aiDone = false;
    S.result = res;

    Store.completeSection(S.day, 'reading', {
      band: res.band, raw: res.raw,
      correct: res.correct, incorrect: res.incorrect, unanswered: res.unanswered
    });
    refreshHeaderMeta();

    S.phase = 'done';
    draftWrite({ status: 'done', result: res, remaining: S.timer.remaining, answers: {}, flags: [] });

    showResults(document.getElementById('view-reading'), res, true);
    S.submitting = false;
  }

  /* ---------- results ---------- */
  function showResults(el, res, runAI) {
    el.innerHTML = `
      <span class="kicker">Day ${S.plan.day} · Reading results</span>
      <h1 class="page-title">${res.band >= 8 ? 'Outstanding — Band 8 territory!' : res.band >= 7 ? 'Strong performance' : 'A clear map for improvement'}</h1>
      ${res.auto ? `<p class="page-sub">Submitted automatically when time expired.</p>` : ''}

      <div class="results-head">
        <div class="card" style="display:flex; gap:24px; align-items:center; flex-wrap:wrap">
          ${ringSVG(res.band / 9, { size: 128, label: res.band.toFixed(1), sub: 'band', color: Records.bandColor(res.band) })}
          <div>
            <div class="grid grid-2" style="gap:10px; min-width:280px">
              <div class="stat-card"><div class="stat-icon green">${icon('check', 18)}</div><div><strong>${res.correct}/40</strong><span>Correct</span></div></div>
              <div class="stat-card"><div class="stat-icon red">${icon('x', 18)}</div><div><strong>${res.incorrect}</strong><span>Incorrect</span></div></div>
              <div class="stat-card"><div class="stat-icon gold">${icon('alert', 18)}</div><div><strong>${res.unanswered}</strong><span>Unanswered</span></div></div>
              <div class="stat-card"><div class="stat-icon navy">${icon('clock', 18)}</div><div><strong>${res.minutesUsed} min</strong><span>Time used</span></div></div>
            </div>
          </div>
        </div>
      </div>

      <div class="exam-actions" style="margin-bottom:26px">
        <button class="btn btn-primary btn-lg" id="rd-repractice">${icon('refresh', 17)} Re-practice these exact questions</button>
        <button class="btn btn-ghost" id="rd-dash">${icon('home', 16)} Back to dashboard</button>
      </div>

      <h2 class="section-title">${icon('list', 20)} Answer Review — your answers vs the correct key</h2>
      <div class="card review-list">
        ${res.review.map(r => `
          <div class="rev-item ${r.verdict !== 'correct' ? 'miss' : ''}">
            <span class="q-num">${r.q}</span>
            <div style="flex:1; min-width:0">
              <span class="verdict-chip v-${r.verdict}">${r.verdict.toUpperCase()}</span>
              <span class="badge badge-navy" style="margin-left:8px">${TYPE_LABEL[r.type]}</span>
              <p style="font-size:13.5px; color:var(--ink-2); margin-top:6px">${esc(r.prompt)}</p>
              <div class="rev-answers">
                <span class="your">Your answer: <strong>${esc(r.yourAnswer || '—')}</strong></span>
                <span class="key">Correct: ${esc(r.correctAnswer)}</span>
              </div>
              <p class="rev-expl" data-expl="${r.q}">${r.explanation ? esc(r.explanation) : ''}</p>
            </div>
          </div>`).join('')}
      </div>

      <div id="rd-aihost" style="margin-top:26px"></div>`;

    $('#rd-repractice', el).addEventListener('click', () => rePractice(el));
    $('#rd-dash', el).addEventListener('click', () => Router.go('dashboard'));

    if (runAI) runDeepAnalysis(el, res);
  }

  async function runDeepAnalysis(el, res) {
    const host = $('#rd-aihost', el);

    /* already analysed (restored draft) → render saved result */
    if (res.aiDone && res.aiReview) { applyAI(host, res.aiReview); return; }

    const panel = AI.panel(host, 'AI Examiner — Deep Analysis of your Reading paper');
    panel.setStatus('Checking all 40 answers against the key…');

    try {
      panel.setStatus('Examiner Ada is writing explanations and strategy tips…');
      const payload = Prompts.readingMarking({
        titles: S.test.titles,
        minutesUsed: res.minutesUsed,
        questions: res.review.map(r => ({
          n: r.q, type: TYPE_LABEL[r.type], prompt: r.prompt,
          userAnswer: r.yourAnswer, correctAnswer: r.correctAnswer
        }))
      });
      const ai = await AI.requestJSON(payload);
      res.aiDone = true;
      res.aiReview = ai;
      draftWrite({ result: res });
      applyAI(host, ai);
    } catch (e) {
      panel.fail(e.message);
    }
  }

  function applyAI(host, ai) {
    /* merge per-question explanations into the review list */
    if (Array.isArray(ai.review)) {
      ai.review.forEach(rv => {
        const node = document.querySelector(`[data-expl="${rv.q}"]`);
        if (node && rv.explanation) node.textContent = rv.explanation;
      });
    }
    const list = a => Array.isArray(a) && a.length
      ? `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';

    host.innerHTML = `
      <div class="ai-panel">
        <div class="ai-panel-head">
          ${icon('spark', 22)}<h3>AI Examiner — Deep Analysis</h3>
          <span class="badge badge-green">complete</span>
        </div>
        ${ai.summary ? `<div class="fb-block"><h4>${icon('info', 16)} Examiner's summary</h4><p>${esc(ai.summary)}</p></div>` : ''}
        ${ai.strengths && ai.strengths.length ? `<div class="fb-block"><h4>${icon('check', 16)} Strengths</h4>${list(ai.strengths)}</div>` : ''}
        ${ai.weaknesses && ai.weaknesses.length ? `<div class="fb-block"><h4>${icon('x', 16)} Weaknesses to fix</h4>${list(ai.weaknesses)}</div>` : ''}
        ${ai.strategyTips && ai.strategyTips.length ? `<div class="fb-block"><h4>${icon('target', 16)} Strategy for Band 8</h4>${list(ai.strategyTips)}</div>` : ''}
        ${ai.vocabularyFocus && ai.vocabularyFocus.length ? `<div class="fb-block"><h4>${icon('book', 16)} Vocabulary from today's passages</h4>${list(ai.vocabularyFocus)}</div>` : ''}
        ${ai.nextSteps && ai.nextSteps.length ? `<div class="fb-block"><h4>${icon('arrow-right', 16)} Next steps</h4>${list(ai.nextSteps)}</div>` : ''}
        <p class="hint center" style="margin-top:12px">AI analysis for practice guidance — not an official IELTS score.</p>
      </div>`;
  }

  /* ---------- re-practice: same questions, fresh attempt ---------- */
  function rePractice(el) {
    S.answers = {};
    S.flags = new Set();
    S.result = null;
    S.submitting = false;
    S.phase = 'exam';
    startExam(el);
    toast('Same paper, fresh 60 minutes — beat your band!', 'success');
  }

  /* ==========================================================
     MOUNT (entry)
     ========================================================== */
  window.Views.reading = {
    mount(el) {
      /* stop any previous session's autosave/timer before resetting S */
      if (S) cleanupExam();

      const p = Store.getProgress();
      const day = p.currentDay;

      S = {
        day, plan: StudyPlan.getDayPlan(day),
        phase: 'prep', test: null, answers: {}, flags: new Set(),
        timer: null, autosave: null, result: null, submitting: false
      };

      const d = Store.getDraft(day, 'reading');

      if (d && d.test) {
        S.test = d.test;
        S.answers = d.answers || {};
        S.flags = new Set(d.flags || []);

        if (d.status === 'done' && d.result) {
          S.phase = 'done';
          S.result = d.result;
          showResults(el, d.result, !d.result.aiDone);
          return;
        }
        if (d.status === 'exam') {
          const answered = Object.keys(S.answers).length;
          const m = Modal.open({
            title: 'Resume your Reading test?',
            width: 460,
            body: `<p class="confirm-msg">An unfinished attempt was found — <strong>${fmtTime(d.remaining || CONFIG.READING_DURATION)}</strong> remaining, with <strong>${40 - answered}</strong> questions still open.</p>`,
            footer: `
              <button class="btn btn-ghost" data-fresh>Start over</button>
              <button class="btn btn-primary" data-resume>Resume test</button>`
          });
          $('[data-resume]', m.el).addEventListener('click', () => {
            m.close();
            S.phase = 'exam';
            startExam(el, d.remaining);
            refreshCounts(el);
          });
          $('[data-fresh]', m.el).addEventListener('click', () => {
            m.close();
            Store.clearDraft(day, 'reading');
            S.answers = {}; S.flags = new Set(); S.test = null;
            prepScreen(el);
          });
          return;
        }
        if (d.status === 'intro') { S.phase = 'intro'; introScreen(el); return; }
      }

      prepScreen(el);
    }
  };

})();