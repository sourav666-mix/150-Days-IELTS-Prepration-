/* ============================================================
   IELTS PRO 150 — Writing Module  (v2 — fixed)
   Flow: overview → exam (60-min timer · Task 1/2 tabs · word
   meters · PDF upload · autosave) → submit → AI per-task
   analysis (4 criteria, corrections, upgrades, model answers)
   → overall band → re-practice
   Fixes in v2: typed & PDF-uploaded answers are now synced into
   session state (Submit previously always saw empty answers),
   previous session's timer fully stopped on mount (orphaned
   timer could auto-submit a new session), autosave interval
   leak on re-practice, dead code removed.
   ============================================================ */

'use strict';

window.Views = window.Views || {};

(function () {

  let S = null;

  /* ==========================================================
     Helpers
     ========================================================== */
  function wc(text) { return String(text || '').trim().split(/\s+/).filter(Boolean).length; }

  function draftWrite(extra) {
    Store.saveDraft(S.day, 'writing', Object.assign({
      status: S.phase,
      t1Text: S.t1Text, t2Text: S.t2Text, activeTask: S.activeTask,
      remaining: S.timer ? S.timer.remaining : CONFIG.WRITING_DURATION
    }, extra || {}));
  }

  function task1Chart() { return WritingBank.task1Data(S.plan.writing.task1.title); }
  function task1Instruction() {
    const c = task1Chart();
    const label = WritingBank.kindLabel(c ? c.kind : 'chart');
    const plural = c && (c.kind === 'line' || c.kind === 'bar' || c.kind === 'pie') &&
      (c.series ? c.series.length > 1 || (c.pies && c.pies.length > 1) : true);
    return `The ${label}${plural ? 's' : ''} below ${plural ? 'show' : 'shows'} the information. ` +
      `Summarise the information by selecting and reporting the main features, and make comparisons where relevant. ` +
      `Write <strong>at least ${CONFIG.WRITING.TASK1_MIN_WORDS} words</strong>.`;
  }

  /* ==========================================================
     PDF upload (pdf.js lazy-loaded from CDN)
     ========================================================== */
  let _pdfPromise = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (_pdfPromise) return _pdfPromise;
    _pdfPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = () => {
        try {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(window.pdfjsLib);
        } catch (e) { reject(e); }
      };
      s.onerror = () => { _pdfPromise = null; reject(new Error('Could not load the PDF engine (check your internet connection).')); };
      document.head.appendChild(s);
    });
    return _pdfPromise;
  }

  async function extractPdfText(file) {
    const pdfjs = await loadPdfJs();
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    let out = '';
    const maxPages = Math.min(pdf.numPages, 6);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      tc.items.forEach(it => { out += it.str + (it.hasEOL ? '\n' : ' '); });
      out += '\n\n';
    }
    return out.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  async function handlePdfUpload(taskIdx) {
    const input = $('#wt-file' + taskIdx);
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast('PDF is larger than 15 MB.', 'error'); return; }

    toast('Reading your PDF…', 'info', 2000);
    let text;
    try { text = await extractPdfText(file); }
    catch (e) { toast(e.message || 'Failed to read the PDF.', 'error'); return; }

    const words = wc(text);
    if (words < 20) { toast('The PDF contained little readable text — please type your answer instead.', 'warn', 4200); return; }
    text = text.slice(0, 14000);

    const ta = $('#wt-text' + taskIdx);
    /* v2: refreshTask() now syncs the textarea into session state,
       so imported PDF answers reach Submit correctly. */
    const apply = () => { ta.value = text; refreshTask(taskIdx); draftWrite(); };

    if (ta.value.trim().length > 0) {
      const ok = await Modal.confirm({
        title: `Replace your typed answer?`,
        message: `The PDF contains <strong>${words} words</strong>. This will <strong>replace</strong> what you have typed for Task ${taskIdx}.`,
        okLabel: 'Replace with PDF', danger: false
      });
      if (ok) apply();
    } else {
      apply();
      toast(`Imported ${words} words from the PDF.`, 'success');
    }
  }

  /* ==========================================================
     1 · OVERVIEW SCREEN
     ========================================================== */
  function overviewScreen(el) {
    const t1 = S.plan.writing.task1, t2 = S.plan.writing.task2;
    el.innerHTML = `
      <span class="kicker">Day ${S.plan.day} · Writing · 60 minutes</span>
      <h1 class="page-title">IELTS Academic Writing</h1>
      <p class="page-sub">Two tasks, one 60-minute clock. Type your answers — or upload a PDF of a handwritten/typed response — then submit both for full AI band scoring.</p>

      <div class="task-overview">
        <div class="card">
          <h3><span class="badge badge-navy">TASK 1</span> ${esc(t1.type)}</h3>
          <p>${esc(t1.title)}<br>
          <span class="muted">≥ ${t1.minWords} words · suggested ${t1.suggestedMinutes} min · visual rendered on-screen</span></p>
        </div>
        <div class="card">
          <h3><span class="badge badge-gold">TASK 2</span> ${esc(t2.type)} · ${esc(t2.theme)}</h3>
          <p style="display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden">${esc(t2.prompt)}</p>
          <p class="muted">≥ ${t2.minWords} words · suggested ${t2.suggestedMinutes} min</p>
        </div>
      </div>

      <div class="card card-pad-lg" style="max-width:640px">
        <h3 style="font-family:var(--font-head); margin-bottom:10px">How marking works</h3>
        <p style="font-size:14px; color:var(--ink-2); line-height:1.7">
          On submit, Examiner Ada scores <strong>each task against all four official criteria</strong> —
          Task Achievement/Response, Coherence &amp; Cohesion, Lexical Resource, Grammatical Range &amp; Accuracy —
          then corrects your sentences line-by-line, rewrites weak sentences at Band 8, and writes a full model answer for the exact prompt you answered.
          Your overall Writing band is the average of the two tasks.
        </p>
        <div class="exam-actions" style="margin-top:18px">
          <button class="btn btn-primary btn-lg" id="wt-start">${icon('play', 17)} Start the 60-minute timer</button>
        </div>
        <p class="hint" style="margin-top:12px">${icon('info', 13)} PDF upload uses the pdf.js engine (loaded on first use). Timings follow the real exam; pausing is allowed in practice mode.</p>
      </div>`;

    $('#wt-start', el).addEventListener('click', () => { S.phase = 'exam'; startExam(el); });
  }

  /* ==========================================================
     2 · EXAM
     ========================================================== */
  function startExam(el, resumeRemaining) {
    /* v2 FIX: clear any previous timer/autosave before creating
       new ones (prevents the interval leak on re-practice) */
    cleanupExam();

    buildExamUI(el);
    S.timer = new ExamTimer({
      duration: CONFIG.WRITING_DURATION,
      displayEl: $('#wt-timer', el), barEl: $('#wt-bar', el), wrapEl: $('#wt-timerwrap', el),
      checkpoints: CONFIG.WRITING.CHECKPOINTS,
      onWarning: (sec) => {
        const msgs = {
          [40 * 60]: '40 minutes left — suggested: start Task 2 now.',
          [20 * 60]: '20 minutes left — finish Task 2 and proofread both tasks.'
        };
        toast(msgs[sec] || `${fmtTime(sec)} remaining in the Writing test.`, sec <= 60 ? 'error' : 'warn', 3600);
      },
      onExpire: () => { toast('Time is up — your tasks were submitted automatically.', 'warn', 5000); submit(true); }
    });
    if (resumeRemaining != null) {
      S.timer.remaining = Math.max(1, resumeRemaining);
      S.timer._render();
    }
    S.timer.start();
    S.autosave = setInterval(() => { if (S.phase === 'exam' && !S.timer.paused) draftWrite(); }, 8000);
    draftWrite();
  }

  function guideDetails(title, items) {
    return `<details class="help-details"><summary>${icon('info', 15)} ${esc(title)}</summary>
      <div class="hd-body"><ol>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div></details>`;
  }

  function buildExamUI(el) {
    const t1 = S.plan.writing.task1, t2 = S.plan.writing.task2;
    const chart = task1Chart();
    const t1Guide = chart && chart.kind === 'process'
      ? ['Introduction — paraphrase the process description.', 'Overview — state how many stages there are and where it begins/ends.', 'Body — describe the stages IN SEQUENCE using the passive voice (is crushed, is heated…).', 'Use sequence linkers: initially, subsequently, at the following stage, finally.']
      : chart && chart.kind === 'map'
        ? ['Introduction — paraphrase what the maps show and the time gap.', 'Overview — state the biggest overall changes (what has been replaced/added).', 'Body 1 — describe the earlier map briefly.', 'Body 2 — describe the later map, organising by area (north/south, riverside…) and using "has been converted into", "has been replaced by".']
        : ['Introduction — paraphrase the description and units.', 'Overview — 1–2 sentences with the MAIN trend(s) or most striking feature(s); NO detailed numbers here.', 'Body 1 — the largest/most significant data, grouped logically.', 'Body 2 — the remaining categories; compare rather than list.'];

    el.innerHTML = `
      <div class="exam-bar" id="wt-timerwrap">
        <div class="timer-display">${icon('clock', 21)}<span id="wt-timer">${fmtTime(CONFIG.WRITING_DURATION)}</span></div>
        <div class="progressbar"><div class="progressbar-fill" id="wt-bar"></div></div>
        <span class="pill" id="wt-count">T1 0w · T2 0w</span>
        <button class="btn btn-sm btn-ghost" id="wt-pause">${icon('pause', 14)} Pause</button>
        <button class="btn btn-sm btn-primary" id="wt-submit">${icon('check', 14)} Submit both tasks</button>
      </div>

      <div class="task-tabs">
        <button class="task-tab active" data-task="1">Task 1 <span class="tt-meta">${t1.minWords}+ words</span></button>
        <button class="task-tab" data-task="2">Task 2 <span class="tt-meta">${t2.minWords}+ words</span></button>
      </div>

      <!-- ================= TASK 1 ================= -->
      <div class="task-panel active" id="wt-panel1">
        <div class="card task-brief">
          <div class="task-brief-head">
            <span class="badge badge-navy">WRITING TASK 1</span>
            <span class="hint">suggested ${t1.suggestedMinutes} minutes · ${t1.minWords} words minimum</span>
          </div>
          <p class="task-instruction">${task1Instruction()}</p>
          <div class="chart-box">${WritingBank.render(chart)}</div>
          ${guideDetails('Structure guide — Task 1', t1Guide)}
        </div>
        <div class="card editor-card">
          <div class="editor-head">
            <label class="label" style="margin:0">Your Task 1 answer</label>
            <div style="display:flex; gap:8px">
              <button class="btn btn-sm btn-ghost pdf-btn" id="wt-pdfbtn1">${icon('upload', 14)} Upload PDF answer</button>
              <input type="file" id="wt-file1" accept="application/pdf,.pdf" hidden>
            </div>
          </div>
          <textarea id="wt-text1" class="textarea" placeholder="Write your Task 1 report here — or upload a PDF of your answer…" spellcheck="true">${esc(S.t1Text)}</textarea>
          <div class="wordmeter" id="wm1"><div class="wordmeter-bar"><div class="wordmeter-fill"></div></div><span class="wordmeter-count">0 / ${t1.minWords} words</span></div>
        </div>
      </div>

      <!-- ================= TASK 2 ================= -->
      <div class="task-panel" id="wt-panel2">
        <div class="card task-brief">
          <div class="task-brief-head">
            <span class="badge badge-gold">WRITING TASK 2</span>
            <span class="hint">suggested ${t2.suggestedMinutes} minutes · ${t2.minWords} words minimum</span>
          </div>
          <p class="task-instruction">Write an academic essay in response to the point of view, argument or problem below.</p>
          <div class="task-prompt-quote">${esc(t2.prompt)}</div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px">
            <span class="badge badge-navy">${esc(t2.type)}</span>
            <span class="badge badge-gold">${esc(t2.theme)}</span>
          </div>
          ${guideDetails('Structure guide — ' + t2.type, WritingBank.essayGuide(t2.type).structure.concat(WritingBank.essayGuide(t2.type).tips))}
          ${WritingBank.themeVocab(t2.theme).length ? `<details class="help-details"><summary>${icon('book', 15)} Useful vocabulary — ${esc(t2.theme)}</summary>
            <div class="hd-body"><div class="chips" style="display:flex; gap:8px; flex-wrap:wrap">${WritingBank.themeVocab(t2.theme).map(v => `<span class="chip" style="cursor:default">${esc(v)}</span>`).join('')}</div></div></details>` : ''}
        </div>
        <div class="card editor-card">
          <div class="editor-head">
            <label class="label" style="margin:0">Your Task 2 essay</label>
            <div style="display:flex; gap:8px">
              <button class="btn btn-sm btn-ghost pdf-btn" id="wt-pdfbtn2">${icon('upload', 14)} Upload PDF answer</button>
              <input type="file" id="wt-file2" accept="application/pdf,.pdf" hidden>
            </div>
          </div>
          <textarea id="wt-text2" class="textarea" placeholder="Write your Task 2 essay here — or upload a PDF of your answer…" spellcheck="true">${esc(S.t2Text)}</textarea>
          <div class="wordmeter" id="wm2"><div class="wordmeter-bar"><div class="wordmeter-fill"></div></div><span class="wordmeter-count">0 / ${t2.minWords} words</span></div>
        </div>
      </div>`;

    /* ----- tabs ----- */
    $$('.task-tab', el).forEach(b => b.addEventListener('click', () => {
      S.activeTask = Number(b.dataset.task);
      $$('.task-tab', el).forEach(x => x.classList.toggle('active', x === b));
      $('#wt-panel1', el).classList.toggle('active', S.activeTask === 1);
      $('#wt-panel2', el).classList.toggle('active', S.activeTask === 2);
      window.scrollTo({ top: 0 });
      draftWrite();
    }));

    /* ----- editors (refreshTask syncs text into session state) ----- */
    [1, 2].forEach(i => {
      $('#wt-text' + i, el).addEventListener('input', () => refreshTask(i));
    });

    /* ----- PDF ----- */
    [1, 2].forEach(i => {
      $('#wt-pdfbtn' + i, el).addEventListener('click', () => $('#wt-file' + i, el).click());
      $('#wt-file' + i, el).addEventListener('change', () => handlePdfUpload(i));
    });

    /* ----- pause ----- */
    $('#wt-pause', el).addEventListener('click', () => {
      const t = S.timer;
      if (t.expired) return;
      if (t.paused) { t.resume(); toast('Timer resumed.', 'info', 1500); }
      else { t.pause(); draftWrite(); toast('Paused — the countdown is stopped.', 'warn', 2200); }
      $('#wt-pause', el).innerHTML = t.paused ? `${icon('play', 14)} Resume` : `${icon('pause', 14)} Pause`;
    });

    /* ----- submit ----- */
    $('#wt-submit', el).addEventListener('click', confirmSubmit);

    /* restore meters + counters (also syncs any restored draft text) */
    refreshTask(1); refreshTask(2);
    if (S.activeTask === 2) $('.task-tab[data-task="2"]', el).click();
  }

  function refreshTask(i) {
    const t = $('#wt-text' + i);
    if (!t) return;

    /* v2 CRITICAL FIX: keep session state in sync with the live
       editor. Previously S.t1Text/S.t2Text were never updated
       from the textareas, so Submit always saw empty answers
       ("Write or upload at least one answer…" false error), PDF
       uploads never reached marking, and drafts saved empty. */
    if (i === 1) S.t1Text = t.value;
    else S.t2Text = t.value;

    const words = wc(t.value);
    const min = i === 1 ? CONFIG.WRITING.TASK1_MIN_WORDS : CONFIG.WRITING.TASK2_MIN_WORDS;
    const wm = $('#wm' + i);
    if (wm) {
      wm.classList.toggle('ok', words >= min);
      $('.wordmeter-fill', wm).style.width = Math.min(100, (words / min) * 100) + '%';
      $('.wordmeter-count', wm).textContent = `${words} / ${min} words${words >= min ? ' ✓' : ''}`;
    }
    const c = $('#wt-count');
    if (c) c.textContent = `T1 ${wc($('#wt-text1') ? $('#wt-text1').value : '')}w · T2 ${wc($('#wt-text2') ? $('#wt-text2').value : '')}w`;
  }

  /* ==========================================================
     3 · SUBMIT
     ========================================================== */
  async function confirmSubmit() {
    if (S.submitting) return;
    const w1 = wc(S.t1Text), w2 = wc(S.t2Text);
    if (!w1 && !w2) { toast('Write or upload at least one answer before submitting.', 'error'); return; }
    if (!w1 || !w2) {
      const ok = await Modal.confirm({
        title: 'One task is empty',
        message: `Task ${!w1 ? '1' : '2'} has no answer. Submitting both tasks is required for an overall band — submit anyway?`,
        okLabel: 'Submit anyway', danger: true
      });
      if (!ok) return;
    } else {
      const warns = [];
      if (w1 < CONFIG.WRITING.TASK1_MIN_WORDS) warns.push(`Task 1 is ${w1} words (minimum ${CONFIG.WRITING.TASK1_MIN_WORDS})`);
      if (w2 < CONFIG.WRITING.TASK2_MIN_WORDS) warns.push(`Task 2 is ${w2} words (minimum ${CONFIG.WRITING.TASK2_MIN_WORDS})`);
      const ok = await Modal.confirm({
        title: 'Submit both tasks for AI marking?',
        message: warns.length
          ? `${warns.join('<br>')}<br><br>Under-length answers are penalised in the real exam — Examiner Ada will still mark them fully and explain the penalty.`
          : 'Both answers meet the minimum length. Submit and run the AI examiner\u2019s full analysis?',
        okLabel: warns.length ? 'Submit anyway' : 'Submit & analyse', danger: warns.length
      });
      if (!ok) return;
    }
    submit(false);
  }

  function cleanupExam() {
    if (S && S.autosave) { clearInterval(S.autosave); S.autosave = null; }
    if (S && S.timer) S.timer.pause();
  }

  async function submit(auto) {
    if (S.submitting || S.phase !== 'exam') return;
    S.submitting = true;
    cleanupExam();

    const minutesUsed = Math.round((CONFIG.WRITING_DURATION - S.timer.remaining) / 60);
    const wordsT1 = wc(S.t1Text), wordsT2 = wc(S.t2Text);

    /* record completion immediately (bands merged in after AI) */
    Store.completeSection(S.day, 'writing', { wordsT1, wordsT2, minutesUsed, band: null });
    refreshHeaderMeta();

    S.phase = 'done';
    S.result = {
      minutesUsed, auto: !!auto, wordsT1, wordsT2,
      t1: { aiDone: false }, t2: { aiDone: false }, overall: null, model: AI.currentModel()
    };
    draftWrite({ status: 'done', result: S.result });

    showResults(document.getElementById('view-writing'), true);
    S.submitting = false;
  }

  /* ==========================================================
     4 · RESULTS + AI ANALYSIS
     ========================================================== */
  function critBar(label, band, color) {
    const pct = clamp((band / 9) * 100, 0, 100);
    return `<div class="skill-row">
      <span class="crit-name">${esc(label)}</span>
      <div class="skill-track">
        <div class="skill-fill" style="width:${pct}%; background:${color}"></div>
        <span class="skill-target" style="left:${((8 / 9) * 100).toFixed(1)}%" title="Band 8.0 target"></span>
      </div>
      <span class="skill-val" style="color:${Records.bandColor(band)}">${band.toFixed(1)}</span>
    </div>`;
  }

  function aiPanelHTML(r, taskLabel) {
    const C = r.criteria || {};
    const list = a => Array.isArray(a) && a.length ? `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
    const corr = Array.isArray(r.issues) ? r.issues.map(i => `
      <div class="corr">
        <span class="verdict-chip v-incorrect">${esc(i.type || 'error')}</span>
        <p class="corr-orig"><del>${esc(i.original)}</del></p>
        <p class="corr-fix"><ins>${esc(i.corrected)}</ins></p>
        ${i.explanation ? `<p class="corr-expl">${esc(i.explanation)}</p>` : ''}
      </div>`).join('') : '';
    const upg = Array.isArray(r.upgradedSentences) ? r.upgradedSentences.map(u => `
      <div class="upg">
        <p><del>${esc(u.original)}</del></p>
        <p class="band8">→ ${esc(u.band8)}</p>
      </div>`).join('') : '';

    return `
      <div class="ai-panel" style="margin-top:14px">
        <div class="ai-panel-head">
          ${icon('spark', 22)}<h3>AI Examiner — ${esc(taskLabel)}</h3>
          <span class="band-chip">Band ${r.overallBand != null ? Number(r.overallBand).toFixed(1) : '—'}</span>
        </div>
        ${r.wordCountFeedback ? `<div class="fb-block"><h4>${icon('file', 16)} Word count</h4><p>${esc(r.wordCountFeedback)}</p></div>` : ''}
        <div class="fb-block">
          <h4>${icon('target', 16)} The four criteria</h4>
          ${['task', 'coherence', 'lexical', 'grammar'].map((k, i) =>
            C[k] ? critBar(C[k].label || k, Number(C[k].band) || 0, WritingBank.PALETTE[i]) : ''
          ).join('')}
        </div>
        ${C.task && C.task.comment ? `<div class="fb-block"><h4>${icon('info', 16)} Task comment</h4><p>${esc(C.task.comment)}</p></div>` : ''}
        ${Array.isArray(r.strengths) && r.strengths.length ? `<div class="fb-block"><h4>${icon('check', 16)} Strengths</h4>${list(r.strengths)}</div>` : ''}
        ${corr ? `<div class="fb-block"><h4>${icon('pen', 16)} Sentence corrections</h4>${corr}</div>` : ''}
        ${upg ? `<div class="fb-block"><h4>${icon('arrow-right', 16)} Upgraded to Band 8</h4>${upg}</div>` : ''}
        ${Array.isArray(r.priorityFixes) && r.priorityFixes.length ? `<div class="fb-block"><h4>${icon('target', 16)} Priority fixes for your next answer</h4>${list(r.priorityFixes)}</div>` : ''}
        ${r.sampleAnswer ? `<div class="fb-block model-answer"><h4>${icon('star', 16)} Examiner\u2019s Band 8–9 model answer for THIS exact prompt</h4>
          <details><summary style="cursor:pointer; font-weight:700; color:var(--primary-600); padding:8px 0">Show model answer</summary>
          <pre>${esc(r.sampleAnswer)}</pre></details></div>` : ''}
        <p class="hint center" style="margin-top:12px">AI assessment for practice guidance — not an official IELTS score.</p>
      </div>`;
  }

  function showResults(el, runAI) {
    const res = S.result;
    const t1 = S.plan.writing.task1, t2 = S.plan.writing.task2;

    el.innerHTML = `
      <span class="kicker">Day ${S.plan.day} · Writing results</span>
      <h1 class="page-title">Your marked scripts</h1>
      ${res.auto ? '<p class="page-sub">Submitted automatically when time expired.</p>' : ''}

      <div class="results-head">
        <div class="card overall-card">
          <div id="wt-overall-ring">${ringSVG(0, { size: 128, label: '—', sub: 'overall band', color: 'var(--accent)' })}</div>
          <div class="task-band-cards">
            <div class="tbc"><h4>Task 1</h4><strong id="wt-b1" style="color:var(--ink-3)">—</strong><span>${res.wordsT1} words</span></div>
            <div class="tbc"><h4>Task 2</h4><strong id="wt-b2" style="color:var(--ink-3)">—</strong><span>${res.wordsT2} words</span></div>
          </div>
        </div>
      </div>

      <div class="exam-actions" style="margin-bottom:26px">
        <button class="btn btn-primary btn-lg" id="wt-repractice">${icon('refresh', 17)} Re-practice these tasks</button>
        <button class="btn btn-ghost" id="wt-dash">${icon('home', 16)} Back to dashboard</button>
      </div>

      <h2 class="section-title">${icon('chart', 20)} Task 1 — ${esc(t1.type)} <span class="hint" style="margin-left:6px">${res.wordsT1} words · ${res.minutesUsed} min used</span></h2>
      <div id="wt-aihost1"></div>

      <h2 class="section-title" style="margin-top:34px">${icon('pen', 20)} Task 2 — ${esc(t2.type)} · ${esc(t2.theme)}</h2>
      <div id="wt-aihost2"></div>`;

    $('#wt-repractice', el).addEventListener('click', () => {
      S.t1Text = ''; S.t2Text = ''; S.result = null; S.submitting = false;
      S.activeTask = 1; S.phase = 'exam';
      Store.clearDraft(S.day, 'writing');
      startExam(el);
      toast('Same tasks, fresh 60 minutes — aim higher!', 'success');
    });
    $('#wt-dash', el).addEventListener('click', () => Router.go('dashboard'));

    if (runAI) runAnalysis();
  }

  function overallFrom(res) {
    const bands = [res.t1, res.t2].map(t => t.overallBand).filter(b => typeof b === 'number');
    if (!bands.length) return null;
    return Math.round((bands.reduce((a, b) => a + b, 0) / bands.length) * 2) / 2; // nearest half
  }

  function updateOverall(res) {
    const overall = overallFrom(res);
    if (overall == null) return;
    res.overall = overall;
    const ringHost = $('#wt-overall-ring');
    if (ringHost) ringHost.innerHTML = ringSVG(overall / 9, { size: 128, label: overall.toFixed(1), sub: 'overall band', color: Records.bandColor(overall) });
    const b1 = $('#wt-b1'), b2 = $('#wt-b2');
    if (b1 && typeof res.t1.overallBand === 'number') { b1.textContent = res.t1.overallBand.toFixed(1); b1.style.color = Records.bandColor(res.t1.overallBand); }
    if (b2 && typeof res.t2.overallBand === 'number') { b2.textContent = res.t2.overallBand.toFixed(1); b2.style.color = Records.bandColor(res.t2.overallBand); }

    Store.completeSection(S.day, 'writing', {
      band: overall,
      task1Band: typeof res.t1.overallBand === 'number' ? res.t1.overallBand : null,
      task2Band: typeof res.t2.overallBand === 'number' ? res.t2.overallBand : null
    });
    refreshHeaderMeta();
  }

  async function runAnalysis() {
    const t1 = S.plan.writing.task1, t2 = S.plan.writing.task2;
    const res = S.result;
    const chart = task1Chart();

    /* ---- Task 1 ---- */
    const host1 = $('#wt-aihost1');
    if (res.wordsT1 > 0) {
      const p1 = AI.panel(host1, 'AI Examiner — Task 1 report marking');
      p1.setStatus('Scoring against the four official criteria…');
      try {
        const r = await AI.requestJSON(
          Prompts.writingTask1({
            chartType: (chart ? WritingBank.kindLabel(chart.kind) : 'visual') + (chart ? '' : ' (data unavailable)'),
            chartTitle: t1.title,
            chartData: chart || { note: 'visual description unavailable', title: t1.title, type: t1.type },
            essay: S.t1Text, wordCount: res.wordsT1
          }), { maxTokens: 3800 });
        Object.assign(res.t1, r, { aiDone: true });
        p1.finish(aiPanelHTML(res.t1, 'Task 1 · ' + t1.type));
      } catch (e) { p1.fail(e.message); }
      updateOverall(res);
      draftWrite({ result: res });
    } else {
      host1.innerHTML = `<div class="empty-state" style="padding:30px 18px">${icon('alert', 30)}<h3>Task 1 was not answered</h3><p>No AI marking possible — the overall band reflects Task 2 only.</p></div>`;
    }

    /* ---- Task 2 ---- */
    const host2 = $('#wt-aihost2');
    if (res.wordsT2 > 0) {
      const p2 = AI.panel(host2, 'AI Examiner — Task 2 essay marking');
      p2.setStatus('Scoring against the four official criteria…');
      try {
        const r = await AI.requestJSON(
          Prompts.writingTask2({
            prompt: t2.prompt, essayType: t2.type, theme: t2.theme,
            essay: S.t2Text, wordCount: res.wordsT2
          }), { maxTokens: 3800 });
        Object.assign(res.t2, r, { aiDone: true });
        p2.finish(aiPanelHTML(res.t2, 'Task 2 · ' + t2.type));
      } catch (e) { p2.fail(e.message); }
      updateOverall(res);
      draftWrite({ result: res });
    } else {
      host2.innerHTML = `<div class="empty-state" style="padding:30px 18px">${icon('alert', 30)}<h3>Task 2 was not answered</h3><p>No AI marking possible — the overall band reflects Task 1 only.</p></div>`;
    }

    if (res.overall != null) toast(`Writing band: ${res.overall.toFixed(1)} — saved to your progress.`, res.overall >= 8 ? 'success' : 'info', 4200);
  }

  /* ==========================================================
     MOUNT
     ========================================================== */
  window.Views.writing = {
    mount(el) {
      /* v2 FIX: fully tear down any previous session first — an
         orphaned still-running timer could otherwise auto-submit
         this fresh session when it expired. */
      if (S) cleanupExam();

      const p = Store.getProgress();
      const day = p.currentDay;

      S = {
        day, plan: StudyPlan.getDayPlan(day),
        phase: 'prep', timer: null, autosave: null,
        t1Text: '', t2Text: '', activeTask: 1,
        result: null, submitting: false
      };

      const d = Store.getDraft(day, 'writing');

      if (d && d.status) {
        S.t1Text = d.t1Text || '';
        S.t2Text = d.t2Text || '';
        S.activeTask = d.activeTask === 2 ? 2 : 1;

        if (d.status === 'done' && d.result) {
          S.phase = 'done';
          S.result = d.result;
          showResults(el, !d.result.overall && !d.result.t1.aiDone && !d.result.t2.aiDone);
          return;
        }
        if (d.status === 'exam') {
          const w1 = wc(S.t1Text), w2 = wc(S.t2Text);
          const m = Modal.open({
            title: 'Resume your Writing test?',
            width: 470,
            body: `<p class="confirm-msg">An unfinished attempt was found — <strong>${fmtTime(d.remaining || CONFIG.WRITING_DURATION)}</strong> remaining.<br>
              Task 1: <strong>${w1}</strong> words · Task 2: <strong>${w2}</strong> words.</p>`,
            footer: `
              <button class="btn btn-ghost" data-fresh>Start over</button>
              <button class="btn btn-primary" data-resume>Resume test</button>`
          });
          $('[data-resume]', m.el).addEventListener('click', () => {
            m.close();
            S.phase = 'exam';
            startExam(el, d.remaining);
          });
          $('[data-fresh]', m.el).addEventListener('click', () => {
            m.close();
            Store.clearDraft(day, 'writing');
            S.t1Text = ''; S.t2Text = ''; S.activeTask = 1;
            overviewScreen(el);
          });
          return;
        }
      }

      overviewScreen(el);
    }
  };

})();
