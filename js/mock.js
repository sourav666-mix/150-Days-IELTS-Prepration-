/* ============================================================
   IELTS PRO 150 — Mock Exam Mode
   One continuous sitting: Reading (60m) → Writing (60m) →
   Listening (30m). Pause buttons hidden, live progress bar,
   section-complete detection via the global event, automatic
   final report + optional AI debrief. Refresh-safe: state is
   persisted under its own storage key.
   ============================================================ */

'use strict';

window.Views = window.Views || {};

(function () {

  const MOCK_KEY = CONFIG.STORAGE_PREFIX + 'mock';
  const STAGES = ['reading', 'writing', 'listening'];
  const LABEL  = { reading: 'Reading · 60 min', writing: 'Writing · 60 min', listening: 'Listening · 30 min' };
  const NAME   = { reading: 'Reading', writing: 'Writing', listening: 'Listening' };

  /* ---------- persistence ---------- */
  const read  = () => { try { return JSON.parse(localStorage.getItem(MOCK_KEY)) || null; } catch { return null; } };
  const write = (r) => { try { localStorage.setItem(MOCK_KEY, JSON.stringify(r)); } catch {} };
  const clear = () => { try { localStorage.removeItem(MOCK_KEY); } catch {} };
  function history() { const r = read(); return (r && Array.isArray(r.history)) ? r.history : []; }
  window.MockAPI = { read, history };

  /* ---------- floating bar ---------- */
  let barEl = null;
  function showBar(html) {
    if (!barEl) { barEl = document.createElement('div'); barEl.id = 'mock-bar'; document.body.appendChild(barEl); }
    barEl.innerHTML = html;
  }
  function hideBar() { if (barEl) { barEl.remove(); barEl = null; } }

  function barActive(cur, idx) {
    return `
      <div class="mockbar-left">${icon('target', 18)}
        <div><strong>MOCK EXAM</strong><span>Section ${idx} of 3 · ${esc(LABEL[cur])}</span></div>
      </div>
      <div class="mockbar-right">
        <button class="btn btn-sm btn-ghost" data-mabort>Abort</button>
      </div>`;
  }
  function barDone(done, next) {
    return `
      <div class="mockbar-left" style="color:var(--success)">${icon('check', 18)}
        <div><strong>${esc(NAME[done])} complete ✓</strong><span>Next up: ${esc(LABEL[next])}</span></div>
      </div>
      <div class="mockbar-right">
        <button class="btn btn-sm btn-primary" data-mgo="${next}">Continue ${icon('arrow-right', 14)}</button>
        <button class="btn btn-sm btn-ghost" data-mabort>Abort</button>
      </div>`;
  }

  /* bar button delegation (bound once) */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mgo],[data-mabort]');
    if (!b) return;
    const r = read();
    if (!r || !r.active) return;
    if (b.dataset.mgo) Router.go(b.dataset.mgo);
    if (b.dataset.mabort) abortFlow();
  });

  /* ---------- section-complete watcher ---------- */
  document.addEventListener('ielts:section-complete', (e) => {
    const r = read();
    if (!r || !r.active) return;
    const d = e.detail || {};
    if (d.day !== r.startDay) return;
    if (r.stages[d.section]) return;

    r.stages[d.section] = 'done';
    const next = STAGES.find(s => !r.stages[s]);

    if (next) {
      r.current = next;
      write(r);
      showBar(barDone(d.section, next));
      toast(`${NAME[d.section]} complete — continue to ${NAME[next]}.`, 'success', 5000);
    } else {
      finishMock(r);
    }
  });

  /* ---------- bands / report ---------- */
  function collectBands(startDay) {
    const rec = Store.getProgress().days[startDay] || {};
    const g = s => (rec[s] && typeof rec[s].band === 'number') ? rec[s].band : null;
    return { reading: g('reading'), writing: g('writing'), listening: g('listening') };
  }
  function overallOf(bands) {
    const vals = Object.keys(bands).map(k => bands[k]).filter(v => typeof v === 'number');
    return vals.length ? Math.round((vals.reduce((a, c) => a + c, 0) / vals.length) * 2) / 2 : null;
  }

  function finishMock(r) {
    r.active = false;
    delete document.body.dataset.mock;
    hideBar();

    const bands = collectBands(r.startDay);
    const overall = overallOf(bands);
    r.report = { date: todayISO(), startDay: r.startDay, bands, overall, at: Date.now() };
    r.history = [{ date: r.report.date, startDay: r.startDay, bands, overall, at: Date.now() }, ...(r.history || [])].slice(0, 10);
    write(r);

    refreshHeaderMeta();
    toast(overall != null ? `Mock complete — overall band ${overall.toFixed(1)}!` : 'Mock complete!', overall != null && overall >= 8 ? 'success' : 'info', 5000);
    Router.go('mock');
  }

  function abortFlow() {
    Modal.confirm({
      title: 'Abort this mock exam?',
      message: 'Sections you already submitted keep their individual results in your progress, but the mock run and its final report will be discarded.',
      okLabel: 'Abort mock', danger: true
    }).then(ok => {
      if (!ok) return;
      clear();
      delete document.body.dataset.mock;
      hideBar();
      toast('Mock aborted.', 'warn', 2500);
      Router.go('dashboard');
    });
  }

  /* ==========================================================
     SCREENS
     ========================================================== */
  function briefingScreen(el) {
    const p = Store.getProgress();
    const day = p.currentDay;
    const plan = StudyPlan.getDayPlan(day);
    const existing = STAGES.filter(s => Store.getDraft(day, s));
    const doneCnt  = STAGES.filter(s => Store.isSectionDone(day, s)).length;

    el.innerHTML = `
      <span class="kicker">Simulation · 2 h 30 min total</span>
      <h1 class="page-title">Full Mock Exam</h1>
      <p class="page-sub">Sit all three papers back-to-back under exam conditions — the closest rehearsal for test day.</p>

      <div class="blueprint">
        <span class="chip">${icon('book', 15)} Reading · 60 min · 40 Q</span>
        <span class="chip">${icon('pen', 15)} Writing · 60 min · 2 tasks</span>
        <span class="chip">${icon('headphones', 15)} Listening · 30 min · 40 Q</span>
        <span class="chip">${icon('x', 15)} Pausing disabled</span>
        <span class="chip">${icon('clock', 15)} Auto-submit on expiry</span>
      </div>

      <div class="grid grid-2" style="margin-top:6px">
        <div class="card">
          <h3 style="font-family:var(--font-head); margin-bottom:10px">${icon('info', 18)} How it runs</h3>
          <ul style="margin-left:18px; font-size:14px; color:var(--ink-2); line-height:1.8">
            <li>Sections run in official order — a progress bar floats on screen.</li>
            <li>Finish a paper and its AI analysis screen appears as usual; click <strong>Continue</strong> when ready.</li>
            <li>Choose built-in or AI-generated papers inside each section as normal.</li>
            <li>At the end you get a combined report with your overall band and an optional AI debrief.</li>
          </ul>
          ${plan.isMock ? `<p class="hint" style="margin-top:8px">${icon('star', 13)} Today is a scheduled mock day (Day ${day} — every 15th day).</p>` : ''}
        </div>
        <div class="card">
          <h3 style="font-family:var(--font-head); margin-bottom:10px">${icon('alert', 18)} Before you start</h3>
          ${doneCnt > 0
            ? `<p style="font-size:14px; color:var(--danger); font-weight:600; margin-bottom:10px">${icon('alert', 14)} Day ${day} already has ${doneCnt} completed section${doneCnt === 1 ? '' : 's'} — running the mock will overwrite them.</p>`
            : `<p style="font-size:14px; color:var(--ink-2); margin-bottom:10px">Day ${day} is clear — nothing will be overwritten.</p>`}
          <label class="switch-row"><span>Clear today's saved attempts for a fresh run</span>
            <span class="switch"><input type="checkbox" id="mk-clear" ${existing.length ? 'checked' : ''}><i></i></span></label>
          <p class="hint" style="margin-top:10px">Tip: generate any AI papers <em>before</em> starting, so writing time stays authentic.</p>
        </div>
      </div>

      <div class="exam-actions" style="margin-top:22px">
        <button class="btn btn-primary btn-lg" id="mk-start">${icon('play', 17)} ${doneCnt > 0 ? 'Start mock (overwrite today\u2019s results)' : 'Start full mock exam'}</button>
        <button class="btn btn-ghost" id="mk-dash">${icon('home', 16)} Not now</button>
      </div>`;

    $('#mk-start', el).addEventListener('click', () => {
      const clearFirst = $('#mk-clear', el).checked;
      if (clearFirst) STAGES.forEach(s => Store.clearDraft(day, s));

      const r = { active: true, startDay: day, startedAt: Date.now(), current: 'reading', stages: {}, history: history() };
      write(r);
      document.body.dataset.mock = '1';
      showBar(barActive('reading', 1));
      toast('Mock started — Reading first. Good luck!', 'info', 3500);
      Router.go('reading');
    });
    $('#mk-dash', el).addEventListener('click', () => Router.go('dashboard'));
  }

  function statusScreen(el) {
    const r = read();
    document.body.dataset.mock = '1';
    const rec = Store.getProgress().days[r.startDay] || {};
    const idx = STAGES.indexOf(r.current);

    showBar(barActive(r.current, idx + 1));

    el.innerHTML = `
      <span class="kicker">Simulation in progress · started ${Records.timeAgo(r.startedAt) || 'just now'}</span>
      <h1 class="page-title">Mock Exam — Day ${r.startDay}</h1>
      <p class="page-sub">Your run is saved even if you refresh. Complete sections in order.</p>

      <div class="mtl">
        ${STAGES.map((s, i) => {
          const done = !!r.stages[s];
          const isCur = s === r.current;
          const band = rec[s] && typeof rec[s].band === 'number' ? rec[s].band : null;
          const state = done ? 'done' : isCur ? 'current' : '';
          const ic = done ? 'check' : isCur ? 'play' : 'clock';
          const cls = done ? 'green' : isCur ? 'navy' : 'gold';
          const stTxt = done
            ? (band != null ? `Submitted — Band ${band.toFixed(1)}` : 'Submitted')
            : isCur ? 'In progress — open this section to continue' : 'Waiting';
          return `
            <div class="mtl-item ${state}">
              <div class="stat-icon ${cls}">${icon(ic, 20)}</div>
              <div><h4>Section ${i + 1} · ${esc(LABEL[s])}</h4><p>${stTxt}</p></div>
              <div class="mtl-go">
                ${done && band != null ? `<span class="mtl-band">${band.toFixed(1)}</span>` : ''}
                <button class="btn btn-sm ${isCur && !done ? 'btn-primary' : 'btn-ghost'}" data-mgo="${s}">
                  ${icon(done ? 'refresh' : 'play', 14)} ${done ? 'Open' : isCur ? 'Go' : 'Preview'}
                </button>
              </div>
            </div>`;
        }).join('')}
      </div>

      <div class="exam-actions">
        <button class="btn btn-danger-ghost" id="mk-abort2">${icon('stop', 15)} Abort mock</button>
      </div>`;

    $('#mk-abort2', el).addEventListener('click', abortFlow);
  }

  function finalReportScreen(el) {
    const r = read();
    if (!r || !r.report) { briefingScreen(el); return; }
    const rep = r.report;

    el.innerHTML = `
      <span class="kicker">Simulation report · ${esc(rep.date)} · Day ${rep.startDay}</span>
      <h1 class="page-title">Your Mock Exam Result</h1>
      <p class="page-sub">Three papers, one sitting. This is your most realistic Band 8 checkpoint.</p>

      <div class="rep-grid">
        ${['reading', 'writing', 'listening'].map(s => `
          <div class="rep-card">
            <h4>${esc(NAME[s])}</h4>
            <strong style="color:${rep.bands[s] != null ? Records.bandColor(rep.bands[s]) : 'var(--ink-3)'}">${rep.bands[s] != null ? rep.bands[s].toFixed(1) : '—'}</strong>
            <small>${rep.bands[s] == null ? 'band not recorded — run AI marking' : 'band'}</small>
          </div>`).join('')}
        <div class="rep-card rep-overall">
          <h4>Overall</h4>
          <strong>${rep.overall != null ? rep.overall.toFixed(1) : '—'}</strong>
          <small>target ${CONFIG.TARGET_BAND}.0</small>
        </div>
      </div>

      ${rep.overall != null ? `
      <div class="card ring-row" style="margin-bottom:8px">
        ${ringSVG(rep.overall / 9, { size: 120, label: rep.overall.toFixed(1), sub: 'mock overall', color: Records.bandColor(rep.overall) })}
        ${ringSVG(clamp(rep.overall / CONFIG.TARGET_BAND, 0, 1), { size: 120, label: Math.round(clamp(rep.overall / CONFIG.TARGET_BAND, 0, 1) * 100) + '%', sub: 'of Band 8 target', color: 'var(--accent)' })}
        <div style="max-width:420px">
          <p style="font-size:14.5px; color:var(--ink-2); line-height:1.7">${
            rep.overall >= 8 ? 'You are performing at your target band. Keep sharpening consistency — every paper at 8+ is the goal on exam day.'
            : rep.overall >= 7 ? 'Strong result — typically 0.5–1 band away from your target. Focus your next two weeks on your weakest section below.'
            : 'Good diagnostic data. Prioritise your lowest band below and re-drill that skill before your next mock.'}
          </p>
        </div>
      </div>` : ''}

      <div class="exam-actions" style="margin:20px 0 8px">
        <button class="btn btn-primary btn-lg" id="mk-coach">${icon('spark', 17)} AI debrief of this mock</button>
        <button class="btn btn-ghost" id="mk-new">${icon('refresh', 16)} New mock</button>
        <button class="btn btn-ghost" id="mk-clearrec">${icon('trash', 15)} Clear this report</button>
      </div>

      ${(r.history || []).length ? `
      <h2 class="section-title">${icon('calendar', 20)} Mock History</h2>
      <div class="card">
        ${r.history.map(h => `
          <div class="mock-hist-row">
            <strong>${esc(h.date)}</strong><span class="hint">Day ${h.startDay}</span>
            <div class="bands">
              ${['reading', 'writing', 'listening'].map(s => `<span>${NAME[s][0]}: ${h.bands && h.bands[s] != null ? h.bands[s].toFixed(1) : '—'}</span>`).join('')}
            </div>
            <span class="ov" style="color:${h.overall != null ? Records.bandColor(h.overall) : 'var(--ink-3)'}">${h.overall != null ? h.overall.toFixed(1) : '—'}</span>
          </div>`).join('')}
      </div>` : ''}

      <div id="mk-aihost" style="margin-top:20px"></div>`;

    $('#mk-coach', el).addEventListener('click', () => runDebrief(rep));
    $('#mk-new', el).addEventListener('click', () => { clear(); hideBar(); briefingScreen(el); });
    $('#mk-clearrec', el).addEventListener('click', () => { clear(); hideBar(); toast('Mock report cleared.', 'info', 2000); briefingScreen(el); });
  }

  async function runDebrief(rep) {
    const host = $('#mk-aihost');
    const panel = AI.panel(host, 'AI Debrief — your mock performance');
    panel.setStatus('Reviewing all three papers…');
    try {
      const plan = StudyPlan.getDayPlan(rep.startDay);
      const st = Store.stats();
      const ctx = {
        day: rep.startDay, phase: 'Mock simulation (all 3 sections in one sitting)',
        targetBand: CONFIG.TARGET_BAND,
        mockBands: rep.bands, mockOverall: rep.overall,
        averages: Records.sectionAverages(),
        totals: { sectionsDone: st.sectionsDone, streak: st.streak, bestStreak: st.bestStreak },
        today: { readingTopic: plan.reading.topic, essayTheme: plan.writing.task2.theme }
      };
      const ai = await AI.requestJSON(Prompts.coach(ctx));
      panel.finish(`
        <div class="fb-block"><h4>${icon('target', 16)} Priority after this mock</h4><p>${esc(ai.focus || '')}</p></div>
        ${ai.why ? `<div class="fb-block"><h4>${icon('info', 16)} Why</h4><p>${esc(ai.why)}</p></div>` : ''}
        <div class="fb-block"><h4>${icon('spark', 16)} Technique</h4><p>${esc(ai.tip || '')}</p></div>
        ${Array.isArray(ai.drills) && ai.drills.length ? `<div class="fb-block"><h4>${icon('list', 16)} Recovery drills</h4><ul>${ai.drills.map(d => `<li>${esc(d)}</li>`).join('')}</ul></div>` : ''}
        ${ai.motivation ? `<div class="fb-block"><h4>${icon('flame', 16)} Motivation</h4><p>${esc(ai.motivation)}</p></div>` : ''}
        <p class="hint center" style="margin-top:12px">AI guidance for practice only — not an official IELTS assessment.</p>`);
    } catch (e) {
      panel.fail(e.message);
    }
  }

  /* ==========================================================
     MOUNT + session restore after refresh
     ========================================================== */
  window.Views.mock = {
    mount(el) {
      const r = read();
      if (r && r.active) { statusScreen(el); return; }
      if (r && r.report) { finalReportScreen(el); return; }
      briefingScreen(el);
    }
  };

  /* restore bar after a page refresh mid-mock */
  document.addEventListener('DOMContentLoaded', () => {
    const r = read();
    if (r && r.active) {
      document.body.dataset.mock = '1';
      const idx = STAGES.indexOf(r.current);
      showBar(barActive(r.current, idx + 1));
    }
  });

})();