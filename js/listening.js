/* ============================================================
   IELTS PRO 150 — Listening Module  (v2 — fixed)
   Flow: prep → (AI generate | builtin) → intro → exam
   (30-min timer · per-section audio players · autosave)
   → submit → section breakdown + AI deep analysis +
   transcripts with highlighted answers → re-practice
   Fixes in v2: submit→showResults signature crash, one-time
   engine hooks (no listener leak), correct audio behaviour when
   switching sections while paused, re-listen icon state,
   AI explanations persisted into the saved result, live answer
   counter, unified resume path.
   ============================================================ */

'use strict';

window.Views = window.Views || {};

(function () {

  let S = null;
  let activeSection = null;   // section whose recording is loaded in LAudio

  /* ==========================================================
     Helpers
     ========================================================== */
  const TYPE_LABEL = { fill: 'Completion', mcq: 'Multiple Choice', match: 'Matching' };

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().trim()
      .replace(/\s+/g, ' ').replace(/[.!,;:]+$/, '');
  }
  function stripArticles(s) { return norm(s).replace(/\b(the|a|an)\s+/g, ' ').replace(/\s+/g, ' ').trim(); }

  function isCorrect(q, ans) {
    if (ans == null || String(ans).trim() === '') return false;
    const u = norm(ans);
    const keys = []
      .concat(Array.isArray(q.answer) ? q.answer : [q.answer])
      .concat(q.accepts || []);
    return keys.some(k => norm(k) === u || stripArticles(k) === stripArticles(u));
  }

  function allQuestions() {
    const out = [];
    S.test.sections.forEach(s => s.groups.forEach(g => g.questions.forEach(q => out.push({ q, sec: s.num }))));
    return out;
  }
  function unansweredCount() {
    return allQuestions().filter(({ q }) => S.answers[q.n] == null || String(S.answers[q.n]).trim() === '').length;
  }

  function draftWrite(extra) {
    Store.saveDraft(S.day, 'listening', Object.assign({
      status: S.phase, test: S.test, answers: S.answers,
      flags: Array.from(S.flags), remaining: S.timer ? S.timer.remaining : CONFIG.LISTENING_DURATION
    }, extra || {}));
  }

  /* ==========================================================
     Audio engine → UI: ONE-TIME hooks (no per-render leaks).
     Handlers query the live DOM, so they work for exam players
     and result "re-listen" players alike.
     ========================================================== */
  let engineHooked = false;
  function hookAudioEngine() {
    if (engineHooked) return;
    engineHooked = true;

    /* play/pause icons + .playing highlight on every visible card */
    LAudio.on('state', () => {
      const st = LAudio.status();
      $$('.audio-card[data-audio]').forEach(card => {
        const active = Number(card.dataset.audio) === activeSection;
        card.classList.toggle('playing', active && st.state === 'playing');
        const btn = card.querySelector('.audio-playbtn');
        if (btn) btn.innerHTML = icon(active && st.state === 'playing' ? 'pause' : 'play', 22);
      });
      if (st.state === 'idle') {
        $$('.audio-card[data-audio]').forEach(c => c.classList.remove('sticky'));
      }
    });

    /* live "now playing" line + progress bar */
    LAudio.on('sentence', (d) => {
      if (!d || !d.item) return;
      $$('.audio-card[data-audio]').forEach(card => {
        const now = card.querySelector('[data-audionow]');
        const bar = card.querySelector('[data-audiobar]');
        if (!now || !bar || !d.total) return;
        now.textContent = (d.item.speaker ? d.item.speaker + ': ' : '') + d.item.text;
        bar.style.width = ((d.idx / d.total) * 100).toFixed(1) + '%';
      });
    });

    /* plays counters (exam cards only — result cards have no [data-plays]) */
    LAudio.on('playcount', () => {
      if (!S || !S.plays) return;
      $$('.audio-card[data-audio] [data-plays]').forEach(p => {
        const card = p.closest('.audio-card');
        if (card) p.textContent = S.plays[Number(card.dataset.audio)] || 0;
      });
    });
  }

  /* Shared play/pause logic for any audio card */
  function audioCardClick(secNum, sec, card) {
    const st = LAudio.status();
    const isActive = activeSection === secNum;
    if (st.state === 'playing' && isActive) { LAudio.pause(); return; }
    if (st.state === 'paused' && isActive) { LAudio.resume(); return; }
    /* idle/done OR switching to a different recording */
    if (card && card.querySelector('[data-plays]')) {
      S.plays[secNum] = (S.plays[secNum] || 0) + 1;
    }
    activeSection = secNum;
    LAudio.load(sec.transcript);
    LAudio.play();
    if (card) card.classList.add('sticky');
  }

  /* ==========================================================
     1 · PREP SCREEN
     ========================================================== */
  function prepScreen(el) {
    const plan = S.plan;
    const tts = LAudio.supported();
    el.innerHTML = `
      <span class="kicker">Day ${plan.day} · Listening · 30 minutes</span>
      <h1 class="page-title">IELTS Listening</h1>
      <p class="page-sub">Four sections · 40 questions · one 30-minute countdown. Today's scenarios: <strong>${esc(plan.listening.sections.map(s => s.scenario).join(' · '))}</strong>.</p>

      <div class="blueprint">
        <span class="chip">${icon('clock', 15)} 30-minute countdown</span>
        <span class="chip">${icon('headphones', 15)} 4 sections · conversation → monologue → discussion → lecture</span>
        <span class="chip">${icon('volume', 15)} Built-in audio playback</span>
        <span class="chip">${icon('spark', 15)} AI deep analysis + answer key</span>
        <span class="chip">${icon('refresh', 15)} Re-practice after submit</span>
      </div>

      ${tts ? '' : `<div class="no-audio-note">${icon('alert', 18)}<div>
        <strong>Your browser does not support text-to-speech.</strong><br>
        The test will run in reading mode: you can reveal each section's transcript instead of listening. For the full audio experience, use Chrome, Edge or Safari.</div></div>`}

      <div class="card card-pad-lg" style="max-width:640px">
        <h3 style="font-family:var(--font-head); margin-bottom:8px">Choose your test paper</h3>
        <p style="font-size:14px; color:var(--ink-2)">
          <strong>Option A — AI-generated paper:</strong> Examiner Ada writes a brand-new 4-section test using today's scenarios
          (${esc(plan.listening.sections[0].scenario)} … ${esc(plan.listening.sections[3].scenario)}), with scripts, questions and an official answer key. Takes ~2–3 minutes and needs an API key.
        </p>
        <p style="font-size:14px; color:var(--ink-2); margin-top:10px">
          <strong>Option B — built-in paper:</strong> a complete offline test (Lakeside Hotel · The Greenmarket · Canteen food-waste project · Hydrothermal vents) with full scripts.
        </p>
        <p class="hint" style="margin-top:10px">${icon('info', 13)} Audio is generated by your browser's speech engine with different voices per speaker. In the real exam each recording plays <strong>once</strong> — challenge yourself to a single play.</p>
        <div class="source-row">
          <button class="btn btn-primary btn-lg" id="genBtn">${icon('spark', 17)} Generate AI listening test</button>
          <button class="btn btn-ghost btn-lg" id="builtinBtn">${icon('headphones', 17)} Use built-in test</button>
        </div>
        <div id="genHost" class="gen-steps" style="margin-top:18px"></div>
      </div>`;

    $('#builtinBtn', el).addEventListener('click', () => {
      const t = ListeningBank.builtin();
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
      'Section 1 — social conversation (Q1–10)',
      'Section 2 — social monologue (Q11–20)',
      'Section 3 — academic discussion (Q21–30)',
      'Section 4 — academic lecture (Q31–40)',
      'Assembling & validating the test'
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
      const test = await ListeningBank.gen(S.plan, { onStep: setStep });
      toast('AI listening test ready — good luck!', 'success');
      loadTest(test, 'intro');
    } catch (e) {
      btn.disabled = false;
      host.insertAdjacentHTML('beforeend', `
        <div class="fb-block" style="border:none; padding-top:10px">
          <p style="color:var(--danger); font-weight:600">${icon('alert', 15)} ${esc(e.message || 'Generation failed.')}</p>
          <p class="hint">You can retry, or use the built-in test. ${AI.localKey() ? '' : 'Tip: set OPENROUTER_API_KEY on Netlify (or a dev key in Settings) to enable generation.'}</p>
        </div>`);
    }
  }

  /* ==========================================================
     2 · INTRO
     ========================================================== */
  function loadTest(test, phase) {
    S.test = test;
    S.answers = {};
    S.flags = new Set();
    S.phase = phase;
    S.plays = { 1: 0, 2: 0, 3: 0, 4: 0 };
    draftWrite();
    introScreen(document.getElementById('view-listening'));
  }

  function introScreen(el) {
    const t = S.test;
    el.innerHTML = `
      <span class="kicker">Day ${S.plan.day} · Listening</span>
      <h1 class="page-title">Your test is ready</h1>
      <p class="page-sub">${t.source === 'ai' ? 'Freshly generated by Examiner Ada' : 'Built-in practice test'} — review the overview, then start the 30-minute countdown.</p>

      <div class="overview-grid" style="grid-template-columns:repeat(2,1fr)">
        ${t.sections.map((s, i) => `
          <div class="overview-card">
            <strong>Section ${s.num} · ${esc(s.context)}</strong>
            <span>${esc(s.scenario)}</span><br>
            <span class="muted">${s.conversation ? (s.transcript.filter(l => /^[A-Z]+:/.test(l)).length) + ' speaker turns' : 'monologue'} · Q${s.groups[0].questions[0].n}–${s.groups[s.groups.length - 1].questions[s.groups[s.groups.length - 1].questions.length - 1].n}</span>
          </div>`).join('')}
      </div>

      <div class="card" style="display:flex; gap:20px; align-items:center; flex-wrap:wrap; margin-top:6px">
        <div class="stat-icon green">${icon('headphones', 22)}</div>
        <div style="flex:1; min-width:220px">
          <strong style="font-family:var(--font-head)">40 questions · scripts ≈ ${t.transcriptWords.toLocaleString()} words</strong>
          <p class="hint">Each recording plays through your browser's speech engine, with a different voice per speaker.</p>
        </div>
        <span class="badge badge-navy">${t.totalQuestions} questions</span>
      </div>

      <div class="exam-actions">
        <button class="btn btn-primary btn-lg" id="ls-start">${icon('play', 17)} Start the 30-minute timer</button>
        <button class="btn btn-ghost" id="ls-regen">${icon('refresh', 16)} Choose another paper</button>
      </div>`;

    $('#ls-start', el).addEventListener('click', () => { S.phase = 'exam'; startExam(el); });
    $('#ls-regen', el).addEventListener('click', () => { Store.clearDraft(S.day, 'listening'); mount(el); });
  }

  /* ==========================================================
     3 · EXAM
     ========================================================== */
  function startExam(el, resumeRemaining) {
    buildExamUI(el);
    S.timer = new ExamTimer({
      duration: CONFIG.LISTENING_DURATION,
      displayEl: $('#ls-timer', el), barEl: $('#ls-bar', el), wrapEl: $('#ls-timerwrap', el),
      checkpoints: CONFIG.LISTENING.CHECKPOINTS,
      onWarning: (sec) => toast(`${fmtTime(sec)} remaining in the Listening test.`, sec <= 60 ? 'error' : 'warn', 2600),
      onExpire: () => { LAudio.stop(); toast('Time is up — your paper has been submitted automatically.', 'warn', 5000); submit(true); }
    });
    if (resumeRemaining != null) {
      S.timer.remaining = Math.max(1, resumeRemaining);
      S.timer._render();
    }
    S.timer.start();
    S.autosave = setInterval(() => { if (S.phase === 'exam' && !S.timer.paused) draftWrite(); }, 8000);
    draftWrite();
  }

  function audioCardHTML(sec) {
    const tts = LAudio.supported();
    return `
      <div class="audio-card" data-audio="${sec.num}" id="audio-${sec.num}">
        <button class="audio-playbtn" data-act="play" title="Play recording">${icon('play', 22)}</button>
        <div class="audio-mid">
          <div class="audio-title">${icon('volume', 15)} Section ${sec.num} recording
            <span class="hint">plays: <b data-plays>0</b> · real exam: 1</span></div>
          <div class="progressbar"><div class="progressbar-fill" data-audiobar style="width:0%"></div></div>
          <div class="audio-now" data-audionow>${tts ? 'Press play to start the recording.' : 'Audio unavailable — reveal the transcript below instead.'}</div>
        </div>
        <div class="audio-side">
          <button class="icon-btn" data-act="prev" title="Previous sentence">${icon('arrow-left', 16)}</button>
          <button class="icon-btn" data-act="next" title="Next sentence">${icon('arrow-right', 16)}</button>
          <button class="icon-btn" data-act="stop" title="Stop">${icon('stop', 15)}</button>
          <select class="select audio-rate" data-act="rate" title="Speed">
            <option value="0.75">0.75×</option>
            <option value="0.9" selected>0.9×</option>
            <option value="1">1×</option>
            <option value="1.15">1.15×</option>
          </select>
        </div>
      </div>`;
  }

  function buildExamUI(el) {
    const tts = LAudio.supported();

    el.innerHTML = `
      <div class="exam-bar" id="ls-timerwrap">
        <div class="timer-display clickable" id="ls-clock" title="Click to pause / resume the timer">${icon('clock', 21)}<span id="ls-timer">${fmtTime(CONFIG.LISTENING_DURATION)}</span></div>
        <div class="progressbar"><div class="progressbar-fill" id="ls-bar"></div></div>
        <span class="pill" id="ls-count">0 / 40 answered</span>
        <button class="btn btn-sm btn-ghost" id="ls-pause">${icon('pause', 14)} Pause</button>
        <button class="btn btn-sm btn-primary" id="ls-submit">${icon('check', 14)} Submit test</button>
      </div>

      ${tts ? '' : `<div class="no-audio-note">${icon('alert', 18)}<div><strong>Audio unavailable in this browser.</strong> Each section shows a "Reveal transcript" button — read it, then answer within the time limit.</div></div>`}

      <div id="ls-sections">
        ${S.test.sections.map(sec => `
          <section class="ls-section" id="ls-sec${sec.num}">
            <div class="ls-head">
              <span class="badge badge-navy">SECTION ${sec.num}</span>
              <div>
                <h3>Questions ${sec.groups[0].questions[0].n}–${sec.groups[sec.groups.length - 1].questions[sec.groups[sec.groups.length - 1].questions.length - 1].n}</h3>
                <p>${esc(sec.context)} — ${esc(sec.scenario)}</p>
              </div>
            </div>
            ${audioCardHTML(sec)}
            <div data-groups="${sec.num}">
              ${tts ? '' : `<button class="btn btn-sm btn-ghost" data-reveal="${sec.num}">${icon('file', 14)} Reveal transcript (no-audio mode)</button>
                <div class="transcript-box" data-tbox="${sec.num}" hidden></div>`}
              ${sec.groups.map(g => groupHTML(g)).join('')}
            </div>
          </section>`).join('')}
      </div>

      <div class="card" id="ls-navcard" style="margin-top:4px">
        <h4 style="font-family:var(--font-head); font-size:14px; margin-bottom:10px">Question Navigator</h4>
        <div class="qgrid" id="ls-nav"></div>
        <p class="hint" style="margin-top:10px">Green = answered · outline = flagged · click to jump.</p>
      </div>
      <div class="exam-actions">
        <button class="btn btn-primary btn-lg btn-block" id="ls-submit2">${icon('check', 16)} Submit test &amp; get AI analysis</button>
      </div>`;

    /* ----- exam audio cards (icons/state handled by global hooks) ----- */
    $$('[data-audio]', el).forEach(card => {
      const secNum = Number(card.dataset.audio);
      const sec = S.test.sections.find(s => s.num === secNum);

      card.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b || b.tagName === 'SELECT') return;
        const act = b.dataset.act;
        if (act === 'play') {
          if (!LAudio.supported()) return;
          audioCardClick(secNum, sec, card);
        } else if (act === 'stop') {
          LAudio.stop();
          activeSection = null;
          card.classList.remove('sticky');
        } else if (act === 'prev') { LAudio.skip(-1); }
        else if (act === 'next') { LAudio.skip(1); }
      });
      card.querySelector('[data-act="rate"]').addEventListener('change', (e) => {
        LAudio.setRate(Number(e.target.value));
      });
    });

    /* ----- transcript fallback reveal ----- */
    $$('[data-reveal]', el).forEach(b => b.addEventListener('click', () => {
      const sec = S.test.sections.find(s => s.num === Number(b.dataset.reveal));
      const box = $(`[data-tbox="${sec.num}"]`, el);
      box.hidden = !box.hidden;
      if (!box.hidden) box.innerHTML = transcriptHTML(sec);
      b.innerHTML = icon('file', 14) + (box.hidden ? ' Reveal transcript (no-audio mode)' : ' Hide transcript');
    }));

    /* ----- answers (event delegation) ----- */
    $('#ls-sections', el).addEventListener('change', (e) => {
      const inp = e.target;
      const n = Number(inp.dataset.q);
      if (!n) return;
      S.answers[n] = inp.value.trim();
      if (inp.type === 'radio') {
        $$(`input[name="${inp.name}"]`, el).forEach(r => r.closest('.opt').classList.toggle('checked', r.checked));
      }
      refreshCounts();
      draftWrite();
    });
    /* live counter while typing in text inputs */
    $('#ls-sections', el).addEventListener('input', (e) => {
      const inp = e.target;
      if (!inp.matches || !inp.matches('input[type="text"]')) return;
      const n = Number(inp.dataset.q);
      if (!n) return;
      S.answers[n] = inp.value.trim();
      const c = $('#ls-count');
      if (c) c.textContent = `${40 - unansweredCount()} / 40 answered`;
    });
    $('#ls-sections', el).addEventListener('click', (e) => {
      const fb = e.target.closest('.flag-btn');
      if (!fb) return;
      const n = Number(fb.dataset.flag);
      if (S.flags.has(n)) S.flags.delete(n); else S.flags.add(n);
      fb.classList.toggle('on', S.flags.has(n));
      fb.innerHTML = icon('star', 15);
      refreshNav();
      draftWrite();
    });

    /* ----- navigator ----- */
    $('#ls-nav', el).addEventListener('click', (e) => {
      const d = e.target.closest('.qdot');
      if (!d) return;
      const target = document.getElementById('q-' + d.dataset.q);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.style.boxShadow = '0 0 0 3px var(--accent-soft)';
        setTimeout(() => { target.style.boxShadow = ''; }, 900);
      }
    });

    /* ----- pause (stops audio too) — via the button or by clicking the timer clock ----- */
    function togglePause() {
      const t = S.timer;
      if (t.expired) return;
      if (t.paused) { t.resume(); if (LAudio.status().state === 'paused') LAudio.resume(); toast('Timer resumed.', 'info', 1500); }
      else { t.pause(); if (LAudio.status().state === 'playing') LAudio.pause(); draftWrite(); toast('Paused — the countdown and audio are stopped.', 'warn', 2400); }
      $('#ls-pause', el).innerHTML = t.paused ? `${icon('play', 14)} Resume` : `${icon('pause', 14)} Pause`;
    }
    $('#ls-pause', el).addEventListener('click', togglePause);
    $('#ls-clock', el).addEventListener('click', () => {
      /* mock days / strict-pause preference allow no pausing */
      if (document.body.hasAttribute('data-mock') || document.body.hasAttribute('data-strict-pause')) return;
      togglePause();
    });

    $('#ls-submit', el).addEventListener('click', confirmSubmit);
    $('#ls-submit2', el).addEventListener('click', confirmSubmit);

    refreshCounts();
  }

  /* ---------- group / question rendering ---------- */
  function groupHTML(g) {
    let body = '';

    if (g.type === 'fill' && g.formTitle) {
      body = `<div class="form-box"><div class="form-box-title">${esc(g.formTitle)}</div>
        ${g.questions.map(q => `
          <div class="form-row" id="q-${q.n}">
            <span class="q-num">${q.n}</span>
            <span class="f-label">${esc(q.label)}</span>
            <input type="text" class="input blank-input" data-q="${q.n}" value="${esc(S.answers[q.n] || '')}" autocomplete="off" spellcheck="false">
          </div>`).join('')}
      </div>`;
    } else if (g.type === 'fill' && g.notes) {
      body = `${g.notesTitle ? `<div class="form-box" style="margin-bottom:12px"><div class="form-box-title">${esc(g.notesTitle)}</div></div>` : ''}
        ${g.questions.map(q => `
          <div class="note-line" id="q-${q.n}">
            <span class="q-num">${q.n}</span>
            <span class="note-text">${esc(q.label || '')}${q.inline && q.label2 ? ' ' + esc(q.label2) : ''}</span>
            <input type="text" class="input blank-input" data-q="${q.n}" value="${esc(S.answers[q.n] || '')}" autocomplete="off" spellcheck="false">
          </div>`).join('')}`;
    } else {
      body = g.questions.map(q => qItemHTML(q)).join('');
    }

    return `
      <div class="q-group">
        <div class="q-group-head">
          <span class="q-range">${esc(g.title)}</span> · <span class="q-type">${TYPE_LABEL[g.type]}</span>
          <p>${esc(g.instruction)}</p>
        </div>
        ${g.pool ? poolCard(g) : ''}
        <div class="q-list">${body}</div>
      </div>`;
  }

  function poolCard(g) {
    return `<div class="pool-card"><h5>${esc('Options')}</h5><ul>
      ${g.pool.map(op => `<li><span class="pool-label">${esc(op.label)}</span> ${esc(op.text)}</li>`).join('')}
    </ul></div>`;
  }

  function qItemHTML(q) {
    let body = '';
    if (q.type === 'mcq') {
      body = `<div class="opts">${(q.options || []).map(o => `
        <label class="opt ${S.answers[q.n] === o.label ? 'checked' : ''}">
          <input type="radio" name="q${q.n}" data-q="${q.n}" value="${esc(o.label)}" ${S.answers[q.n] === o.label ? 'checked' : ''}>
          <span class="opt-letter">${esc(o.label)}</span><span>${esc(o.text)}</span>
        </label>`).join('')}</div>`;
    } else if (q.type === 'match') {
      const pool = (currentPool(q) || []);
      const cur = S.answers[q.n] || '';
      body = `<div class="match-row">
        <span class="m-name">${esc(q.prompt)}</span>
        <select class="select match-select" data-q="${q.n}">
          <option value="">— choose —</option>
          ${pool.map(op => `<option value="${esc(op.label)}" ${cur === op.label ? 'selected' : ''}>${esc(op.label)} — ${esc(op.text)}</option>`).join('')}
        </select>
      </div>`;
    }
    const flagged = S.flags.has(q.n);
    return `
      <div class="q-item" id="q-${q.n}">
        <span class="q-num">${q.n}</span>
        <div class="q-body">
          ${q.type === 'mcq' ? `<p class="q-prompt">${esc(q.prompt)}</p>` : ''}
          ${body}
        </div>
        <button class="flag-btn ${flagged ? 'on' : ''}" data-flag="${q.n}" title="Flag for review">${icon('star', 15)}</button>
      </div>`;
  }

  function currentPool(q) {
    for (const s of S.test.sections) for (const g of s.groups) {
      if (g.pool && g.questions.some(x => x.n === q.n)) return g.pool;
    }
    return [];
  }

  /* ---------- counts / nav ---------- */
  function refreshCounts() {
    const done = 40 - unansweredCount();
    const c = $('#ls-count');
    if (c) c.textContent = `${done} / 40 answered`;
    refreshNav();
  }
  function refreshNav() {
    const nav = $('#ls-nav');
    if (!nav || !S || !S.test) return;
    nav.innerHTML = allQuestions().map(({ q }) => {
      const ans = S.answers[q.n] != null && String(S.answers[q.n]).trim() !== '';
      const cls = [ans ? 'answered' : '', S.flags.has(q.n) ? 'flagged' : ''].join(' ');
      return `<button class="qdot ${cls}" data-q="${q.n}">${q.n}</button>`;
    }).join('');
  }

  /* ==========================================================
     4 · SUBMIT → RESULTS
     ========================================================== */
  async function confirmSubmit() {
    if (S.submitting) return;
    const un = unansweredCount();
    const ok = await Modal.confirm({
      title: 'Submit your Listening paper?',
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
    const bySec = { 1: 0, 2: 0, 3: 0, 4: 0 };
    let correct = 0;
    allQuestions().forEach(({ q, sec }) => {
      const ua = S.answers[q.n];
      const answered = ua != null && String(ua).trim() !== '';
      const ok = answered && isCorrect(q, ua);
      if (ok) { correct++; bySec[sec]++; }
      const keys = (Array.isArray(q.answer) ? q.answer : [q.answer]).concat(q.accepts || []);
      rows.push({
        q: q.n, section: sec, type: q.type,
        prompt: q.prompt || q.label || `Question ${q.n}`,
        yourAnswer: answered ? String(ua) : '',
        correctAnswer: keys.join(' / '),
        verdict: !answered ? 'unanswered' : ok ? 'correct' : 'incorrect',
        explanation: ''
      });
    });
    return {
      raw: correct,
      band: bandFromRaw(correct, CONFIG.LISTENING_BAND_SCALE),
      correct, incorrect: rows.filter(r => r.verdict === 'incorrect').length,
      unanswered: rows.filter(r => r.verdict === 'unanswered').length,
      bySection: bySec,
      review: rows
    };
  }

  function cleanupExam() {
    if (S && S.autosave) { clearInterval(S.autosave); S.autosave = null; }
    if (S && S.timer) S.timer.pause();
    LAudio.stop();
    activeSection = null;
  }

  async function submit(auto) {
    if (S.submitting || S.phase !== 'exam') return;
    S.submitting = true;
    cleanupExam();

    const minutesUsed = Math.round((CONFIG.LISTENING_DURATION - S.timer.remaining) / 60);
    const res = localMark();
    res.auto = !!auto;
    res.minutesUsed = minutesUsed;
    res.aiDone = false;

    Store.completeSection(S.day, 'listening', {
      band: res.band, raw: res.raw,
      correct: res.correct, incorrect: res.incorrect, unanswered: res.unanswered,
      bySection: res.bySection
    });
    refreshHeaderMeta();

    S.phase = 'done';
    S.result = res;
    draftWrite({ status: 'done', result: res, remaining: S.timer.remaining, answers: {}, flags: [] });

    showResults(document.getElementById('view-listening'), res, true);
    S.submitting = false;
  }

  /* ---------- results ---------- */
  function showResults(el, res, runAI) {
    el.innerHTML = `
      <span class="kicker">Day ${S.plan.day} · Listening results</span>
      <h1 class="page-title">${res.band >= 8 ? 'Outstanding — Band 8 territory!' : res.band >= 7 ? 'Strong performance' : 'A clear map for improvement'}</h1>
      ${res.auto ? '<p class="page-sub">Submitted automatically when time expired.</p>' : ''}

      <div class="results-head">
        <div class="card" style="display:flex; gap:24px; align-items:center; flex-wrap:wrap">
          ${ringSVG(res.band / 9, { size: 128, label: res.band.toFixed(1), sub: 'band', color: Records.bandColor(res.band) })}
          <div style="min-width:280px">
            <div class="grid grid-2" style="gap:10px">
              <div class="stat-card"><div class="stat-icon green">${icon('check', 18)}</div><div><strong>${res.correct}/40</strong><span>Correct</span></div></div>
              <div class="stat-card"><div class="stat-icon red">${icon('x', 18)}</div><div><strong>${res.incorrect}</strong><span>Incorrect</span></div></div>
              <div class="stat-card"><div class="stat-icon gold">${icon('alert', 18)}</div><div><strong>${res.unanswered}</strong><span>Unanswered</span></div></div>
              <div class="stat-card"><div class="stat-icon navy">${icon('clock', 18)}</div><div><strong>${res.minutesUsed} min</strong><span>Time used</span></div></div>
            </div>
            <div class="sec-breakdown">
              ${[1, 2, 3, 4].map(n => {
                const c = (res.bySection && res.bySection[n]) || 0;
                const col = c >= 8 ? 8 : c >= 6.5 ? 7 : c >= 5 ? 6 : 5;
                return `<div class="sbd"><strong style="color:${Records.bandColor(col)}">${c}/10</strong><span>Section ${n}</span></div>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="exam-actions" style="margin-bottom:26px">
        <button class="btn btn-primary btn-lg" id="ls-repractice">${icon('refresh', 17)} Re-practice these exact questions</button>
        <button class="btn btn-ghost" id="ls-dash">${icon('home', 16)} Back to dashboard</button>
      </div>

      <h2 class="section-title">${icon('list', 20)} Answer Review — your answers vs the correct key</h2>
      <div class="card review-list">
        ${res.review.map(r => `
          <div class="rev-item ${r.verdict !== 'correct' ? 'miss' : ''}">
            <span class="q-num">${r.q}</span>
            <div style="flex:1; min-width:0">
              <span class="verdict-chip v-${r.verdict}">${r.verdict.toUpperCase()}</span>
              <span class="section-badge sb-listening" style="margin-left:8px">Sec ${r.section}</span>
              <span class="badge badge-navy" style="margin-left:6px">${TYPE_LABEL[r.type]}</span>
              <p style="font-size:13.5px; color:var(--ink-2); margin-top:6px">${esc(r.prompt)}</p>
              <div class="rev-answers">
                <span class="your">Your answer: <strong>${esc(r.yourAnswer || '—')}</strong></span>
                <span class="key">Correct: ${esc(r.correctAnswer)}</span>
              </div>
              <p class="rev-expl" data-expl="${r.q}">${r.explanation ? esc(r.explanation) : ''}</p>
            </div>
          </div>`).join('')}
      </div>

      <h2 class="section-title">${icon('headphones', 20)} Transcripts — re-listen &amp; see the answers in context</h2>
      ${S.test.sections.map(sec => `
        <div class="card" style="margin-bottom:14px">
          <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap">
            <span class="badge badge-navy">SECTION ${sec.num}</span>
            <strong style="font-family:var(--font-head)">${esc(sec.scenario)}</strong>
            <button class="btn btn-sm btn-ghost" style="margin-left:auto" data-trtoggle="${sec.num}">${icon('chev-down', 15)} Show transcript &amp; re-listen</button>
          </div>
          <div data-trwrap="${sec.num}" hidden>
            <div class="audio-card" data-audio="${sec.num}" data-audio-rt="1" style="margin-top:12px">
              <button class="audio-playbtn" data-act="play">${icon('play', 22)}</button>
              <div class="audio-mid">
                <div class="audio-title">${icon('volume', 15)} Re-listen <span class="hint">unlimited replays</span></div>
                <div class="progressbar"><div class="progressbar-fill" data-audiobar style="width:0%"></div></div>
                <div class="audio-now" data-audionow>Press play.</div>
              </div>
            </div>
            <div class="transcript-box">${transcriptHTML(sec, true)}</div>
          </div>
        </div>`).join('')}

      <div id="ls-aihost" style="margin-top:26px"></div>`;

    $('#ls-repractice', el).addEventListener('click', () => rePractice(el));
    $('#ls-dash', el).addEventListener('click', () => Router.go('dashboard'));

    /* transcript toggles */
    $$('[data-trtoggle]', el).forEach(b => b.addEventListener('click', () => {
      const wrap = $(`[data-trwrap="${b.dataset.trtoggle}"]`, el);
      wrap.hidden = !wrap.hidden;
      b.innerHTML = icon('chev-down', 15) + (wrap.hidden ? ' Show transcript &amp; re-listen' : ' Hide transcript');
    }));

    /* result re-listen players (icons/state handled by global hooks) */
    $$('[data-audio-rt]', el).forEach(card => {
      const secNum = Number(card.dataset.audio);
      const sec = S.test.sections.find(s => s.num === secNum);
      card.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b || b.dataset.act !== 'play') return;
        audioCardClick(secNum, sec, null);
      });
    });

    if (runAI) runDeepAnalysis(el, res);
  }

  /* ---------- transcripts (+ optional answer highlights) ---------- */
  function transcriptHTML(sec, highlight) {
    return sec.transcript.map(line => {
      const m = String(line).match(/^([A-Z][A-Z0-9 _-]{1,24}):\s*(.+)$/);
      const speaker = m ? m[1] : null;
      const text = m ? m[2] : String(line);
      let body = esc(text);
      if (highlight) {
        sec.groups.forEach(g => g.questions.forEach(q => {
          const keys = Array.isArray(q.answer) ? q.answer : [q.answer];
          const k = esc(String(keys[0]));
          const i = body.toLowerCase().indexOf(k.toLowerCase());
          if (i >= 0 && k.length > 1) {
            body = body.slice(0, i) + '<mark class="anshl">' + body.slice(i, i + k.length) + '</mark>' + body.slice(i + k.length);
          }
        }));
      }
      const alt = speaker ? ['alt', 'alt2', 'alt3'][(speaker.length + sec.num) % 3] : '';
      return `<div class="transcript-line">${speaker ? `<span class="speaker-tag ${alt}">${esc(speaker)}</span>` : ''}${body}</div>`;
    }).join('');
  }

  /* ---------- AI deep analysis ---------- */
  async function runDeepAnalysis(el, res) {
    const host = $('#ls-aihost', el);

    /* already analysed (restored draft) → render saved result */
    if (res.aiDone && res.aiReview) { applyAI(host, res.aiReview, el, res); return; }

    const panel = AI.panel(host, 'AI Examiner — Deep Analysis of your Listening paper');
    panel.setStatus('Checking all 40 answers against the key…');
    try {
      panel.setStatus('Examiner Ada is writing explanations and strategy tips…');
      const payload = Prompts.listeningMarking({
        sectionTitles: S.test.titles,
        transcript: S.test.sections.map(s => `[Section ${s.num} — ${s.scenario}]\n` + s.transcript.join('\n')).join('\n\n'),
        minutesUsed: res.minutesUsed,
        questions: res.review.map(r => ({
          n: r.q, section: r.section, type: TYPE_LABEL[r.type], prompt: r.prompt,
          userAnswer: r.yourAnswer, correctAnswer: r.correctAnswer
        }))
      });
      const ai = await AI.requestJSON(payload);
      res.aiDone = true;
      res.aiReview = ai;
      applyAI(host, ai, el, res);
      draftWrite({ result: res });
    } catch (e) {
      panel.fail(e.message);
    }
  }

  function applyAI(host, ai, el, res) {
    /* merge explanations into the saved result (persists across
       re-mounts) AND into the live DOM list */
    if (Array.isArray(ai.review) && res && Array.isArray(res.review)) {
      ai.review.forEach(rv => {
        const row = res.review.find(r => r.q === rv.q);
        if (row && rv.explanation) row.explanation = rv.explanation;
        if (rv.explanation && el) {
          const node = el.querySelector(`[data-expl="${rv.q}"]`);
          if (node) node.textContent = rv.explanation;
        }
      });
    }
    const list = a => Array.isArray(a) && a.length ? `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
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
        ${ai.vocabularyFocus && ai.vocabularyFocus.length ? `<div class="fb-block"><h4>${icon('book', 16)} Vocabulary from today's recordings</h4>${list(ai.vocabularyFocus)}</div>` : ''}
        ${ai.nextSteps && ai.nextSteps.length ? `<div class="fb-block"><h4>${icon('arrow-right', 16)} Next steps</h4>${list(ai.nextSteps)}</div>` : ''}
        <p class="hint center" style="margin-top:12px">AI analysis for practice guidance — not an official IELTS score.</p>
      </div>`;
  }

  /* ---------- re-practice ---------- */
  function rePractice(el) {
    cleanupExam();
    S.answers = {};
    S.flags = new Set();
    S.result = null;
    S.submitting = false;
    S.plays = { 1: 0, 2: 0, 3: 0, 4: 0 };
    S.phase = 'exam';
    startExam(el);
    toast('Same test, fresh 30 minutes — aim for Band 8!', 'success');
  }

  /* ==========================================================
     MOUNT
     ========================================================== */
  window.Views.listening = {
    mount(el) {
      /* stop any leftover session + speech from a previous visit */
      if (S) cleanupExam();
      LAudio.stop();
      activeSection = null;
      hookAudioEngine();

      const p = Store.getProgress();
      const day = p.currentDay;

      S = {
        day, plan: StudyPlan.getDayPlan(day),
        phase: 'prep', test: null, answers: {}, flags: new Set(),
        timer: null, autosave: null, result: null, submitting: false,
        plays: { 1: 0, 2: 0, 3: 0, 4: 0 }
      };

      const d = Store.getDraft(day, 'listening');

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
            title: 'Resume your Listening test?',
            width: 470,
            body: `<p class="confirm-msg">An unfinished attempt was found — <strong>${fmtTime(d.remaining || CONFIG.LISTENING_DURATION)}</strong> remaining, with <strong>${40 - answered}</strong> questions still open.</p>`,
            footer: `
              <button class="btn btn-ghost" data-fresh>Start over</button>
              <button class="btn btn-primary" data-resume>Resume test</button>`
          });
          $('[data-resume]', m.el).addEventListener('click', () => {
            m.close();
            S.phase = 'exam';
            startExam(el, d.remaining);
            refreshCounts();
          });
          $('[data-fresh]', m.el).addEventListener('click', () => {
            m.close();
            Store.clearDraft(day, 'listening');
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