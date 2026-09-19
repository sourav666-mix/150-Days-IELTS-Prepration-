/* ============================================================
   IELTS PRO 150 — Review Center
   Every past session in one place: per-section latest/best,
   full filterable history, saved AI reports for the most
   recent attempt of each session, and mock-exam history.
   ============================================================ */

'use strict';

window.Views = window.Views || {};

(function () {

  const TYPE_LABEL = {
    tfng: 'True/False/NG', ynng: 'Yes/No/NG', mcq: 'Multiple Choice',
    heading: 'Headings', info: 'Matching Info', ending: 'Endings',
    fill: 'Completion', short: 'Short Answer', match: 'Matching'
  };

  /* ---------- small render helpers ---------- */
  function stat(ic, cls, val, lbl) {
    return `<div class="stat-card"><div class="stat-icon ${cls}">${icon(ic, 18)}</div><div><strong>${esc(String(val))}</strong><span>${esc(lbl)}</span></div></div>`;
  }
  function listBlock(ic, title, arr) {
    if (!Array.isArray(arr) || !arr.length) return '';
    return `<div class="fb-block"><h4>${icon(ic, 16)} ${esc(title)}</h4><ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
  }
  function critRow(label, band, color) {
    const pct = clamp((band / 9) * 100, 0, 100);
    return `<div class="skill-row">
      <span class="crit-name">${esc(label)}</span>
      <div class="skill-track">
        <div class="skill-fill" style="width:${pct}%; background:${color}"></div>
        <span class="skill-target" style="left:${((8 / 9) * 100).toFixed(1)}%"></span>
      </div>
      <span class="skill-val" style="color:${Records.bandColor(band)}">${band.toFixed(1)}</span>
    </div>`;
  }
  function corrections(issues) {
    if (!Array.isArray(issues) || !issues.length) return '';
    return `<div class="fb-block"><h4>${icon('pen', 16)} Sentence corrections</h4>${issues.map(i => `
      <div class="corr">
        <span class="verdict-chip v-incorrect">${esc(i.type || 'error')}</span>
        <p class="corr-orig"><del>${esc(i.original)}</del></p>
        <p class="corr-fix"><ins>${esc(i.corrected)}</ins></p>
        ${i.explanation ? `<p class="corr-expl">${esc(i.explanation)}</p>` : ''}
      </div>`).join('')}</div>`;
  }
  function upgrades(list) {
    if (!Array.isArray(list) || !list.length) return '';
    return `<div class="fb-block"><h4>${icon('arrow-right', 16)} Upgraded to Band 8</h4>${list.map(u => `
      <div class="upg"><p><del>${esc(u.original)}</del></p><p class="band8">→ ${esc(u.band8)}</p></div>`).join('')}</div>`;
  }
  function sampleBlock(txt) {
    if (!txt) return '';
    return `<div class="fb-block model-answer"><h4>${icon('star', 16)} Model answer</h4>
      <details><summary style="cursor:pointer; font-weight:700; color:var(--primary-600); padding:8px 0">Show model answer</summary>
      <pre>${esc(txt)}</pre></details></div>`;
  }
  function aiBlocks(ai) {
    if (!ai) return '';
    return `<div class="ai-panel" style="margin:12px 0">
      <div class="ai-panel-head">${icon('spark', 20)}<h3>AI Examiner analysis</h3><span class="badge badge-green">saved</span></div>
      ${ai.summary ? `<div class="fb-block"><h4>${icon('info', 16)} Summary</h4><p>${esc(ai.summary)}</p></div>` : ''}
      ${listBlock('check', 'Strengths', ai.strengths)}
      ${listBlock('x', 'Weaknesses', ai.weaknesses)}
      ${listBlock('target', 'Strategy', ai.strategyTips)}
      ${listBlock('book', 'Vocabulary focus', ai.vocabularyFocus)}
      ${listBlock('arrow-right', 'Next steps', ai.nextSteps)}
    </div>`;
  }

  /* ---------- report renderers ---------- */
  function rlReport(res) {
    return `
      <div class="results-head"><div class="card overall-card">
        ${ringSVG((res.band || 0) / 9, { size: 110, label: res.band != null ? res.band.toFixed(1) : '—', sub: 'band', color: Records.bandColor(res.band) })}
        <div class="grid grid-2" style="gap:10px; min-width:260px">
          ${stat('check', 'green', res.correct + '/40', 'Correct')}
          ${stat('x', 'red', res.incorrect, 'Incorrect')}
          ${stat('alert', 'gold', res.unanswered, 'Unanswered')}
          ${stat('clock', 'navy', (res.minutesUsed != null ? res.minutesUsed : '—') + ' min', 'Time used')}
        </div>
      </div></div>
      ${res.bySection ? `<div class="sec-breakdown" style="margin-bottom:12px">${[1, 2, 3, 4].map(n =>
        `<div class="sbd"><strong>${(res.bySection[n] || 0)}/10</strong><span>Section ${n}</span></div>`).join('')}</div>` : ''}
      ${aiBlocks(res.aiReview)}
      <h4 style="font-family:var(--font-head); margin:14px 0 8px">Answer review</h4>
      <div class="card review-list">
        ${(res.review || []).map(r => `
          <div class="rev-item ${r.verdict !== 'correct' ? 'miss' : ''}">
            <span class="q-num">${r.q}</span>
            <div style="flex:1; min-width:0">
              <span class="verdict-chip v-${r.verdict}">${esc(r.verdict.toUpperCase())}</span>
              ${r.type ? `<span class="badge badge-navy" style="margin-left:8px">${esc(TYPE_LABEL[r.type] || r.type)}</span>` : ''}
              <p style="font-size:13.5px; color:var(--ink-2); margin-top:6px">${esc(r.prompt || '')}</p>
              <div class="rev-answers">
                <span class="your">Your answer: <strong>${esc(r.yourAnswer || '—')}</strong></span>
                <span class="key">Correct: ${esc(r.correctAnswer || '—')}</span>
              </div>
              ${r.explanation ? `<p class="rev-expl">${esc(r.explanation)}</p>` : ''}
            </div>
          </div>`).join('')}
      </div>`;
  }

  function writingTaskBlock(t, label) {
    if (!t || !t.aiDone) {
      return `<div class="empty-state" style="padding:24px 18px">${icon('alert', 26)}
        <h3>${esc(label)} — AI marking not run</h3><p>This attempt was submitted without AI analysis.</p></div>`;
    }
    const C = t.criteria || {};
    return `<div class="ai-panel" style="margin:12px 0">
      <div class="ai-panel-head">${icon('spark', 20)}<h3>${esc(label)}</h3>
        <span class="band-chip">Band ${t.overallBand != null ? Number(t.overallBand).toFixed(1) : '—'}</span></div>
      ${['task', 'coherence', 'lexical', 'grammar'].map((k, i) =>
        C[k] ? critRow(C[k].label || k, Number(C[k].band) || 0, WritingBank.PALETTE[i]) : '').join('')}
      ${t.wordCountFeedback ? `<div class="fb-block"><h4>${icon('file', 16)} Word count</h4><p>${esc(t.wordCountFeedback)}</p></div>` : ''}
      ${listBlock('check', 'Strengths', t.strengths)}
      ${corrections(t.issues)}
      ${upgrades(t.upgradedSentences)}
      ${listBlock('target', 'Priority fixes', t.priorityFixes)}
      ${sampleBlock(t.sampleAnswer)}
    </div>`;
  }

  function writingReport(res) {
    return `
      <div class="results-head"><div class="card overall-card">
        ${ringSVG(((res.overall || 0)) / 9, { size: 110, label: res.overall != null ? res.overall.toFixed(1) : '—', sub: 'overall', color: Records.bandColor(res.overall) })}
        <div class="task-band-cards">
          <div class="tbc"><h4>Task 1</h4><strong style="color:${res.t1 && res.t1.overallBand != null ? Records.bandColor(res.t1.overallBand) : 'var(--ink-3)'}">${res.t1 && res.t1.overallBand != null ? res.t1.overallBand.toFixed(1) : '—'}</strong><span>${res.wordsT1 || 0} words</span></div>
          <div class="tbc"><h4>Task 2</h4><strong style="color:${res.t2 && res.t2.overallBand != null ? Records.bandColor(res.t2.overallBand) : 'var(--ink-3)'}">${res.t2 && res.t2.overallBand != null ? res.t2.overallBand.toFixed(1) : '—'}</strong><span>${res.wordsT2 || 0} words</span></div>
        </div>
      </div></div>
      ${writingTaskBlock(res.t1, 'Task 1')}
      ${writingTaskBlock(res.t2, 'Task 2')}`;
  }

  /* ---------- report modal ---------- */
  function openReport(day, section) {
    const d = Store.getDraft(day, section);
    const res = d && d.status === 'done' && d.result ? d.result : null;
    if (!res) {
      toast('No saved report for this attempt — reports are kept for the most recent submitted attempt only.', 'warn', 4200);
      return;
    }
    const bandTxt = res.band != null ? ` — Band ${res.band}` : (res.overall != null ? ` — Band ${res.overall}` : '');
    const m = Modal.open({
      title: esc(`Day ${day} · ${Records.LABELS[section]}${bandTxt}`),
      width: 780,
      body: section === 'writing' ? writingReport(res) : rlReport(res),
      footer: `<button class="btn btn-primary" data-rvclose>Close</button>`
    });
    $('[data-rvclose]', m.el).addEventListener('click', () => m.close());
  }

  /* ==========================================================
     MOUNT
     ========================================================== */
  let filter = 'all';

  window.Views.review = {
    mount(el) {
      const all = Records.sessions();          // ascending by time
      const hist = window.MockAPI ? MockAPI.history() : [];

      /* per-section latest / best */
      const agg = {};
      Records.SECTIONS.forEach(s => { agg[s] = { count: 0, best: null, latest: null }; });
      all.forEach(x => {
        if (x.band == null) return;
        const a = agg[x.section];
        a.count++;
        if (a.best == null || x.band > a.best) a.best = x.band;
        a.latest = x.band;
      });

      function summaryCards() {
        return `<div class="grid grid-3">
          ${Records.SECTIONS.map(s => {
            const a = agg[s];
            return `<div class="card stat-card">
              <div class="stat-icon ${s === 'reading' ? 'navy' : s === 'writing' ? 'gold' : 'green'}">${icon(s === 'reading' ? 'book' : s === 'writing' ? 'pen' : 'headphones', 20)}</div>
              <div>
                <strong style="color:${a.latest != null ? Records.bandColor(a.latest) : 'var(--ink-3)'}">${a.latest != null ? a.latest.toFixed(1) : '—'}</strong>
                <span>${Records.LABELS[s]} · latest</span><br>
                <span class="best-note">best ${a.best != null ? a.best.toFixed(1) : '—'} · ${a.count} session${a.count === 1 ? '' : 's'}</span>
              </div>
            </div>`;
          }).join('')}
        </div>`;
      }

      function filteredRows() {
        const rows = all.filter(x => filter === 'all' || x.section === filter).slice().reverse();
        if (!rows.length) {
          return `<div class="empty-state" style="padding:36px 18px">${icon('file', 34)}
            <h3>No sessions${filter !== 'all' ? ' for this filter' : ' yet'}</h3>
            <p>Complete sections from the dashboard — every attempt is archived here.</p></div>`;
        }
        return `<div class="table-wrap"><table class="table">
          <thead><tr><th>Day</th><th>Section</th><th>Band</th><th>Raw</th><th>When</th><th></th></tr></thead>
          <tbody>${rows.map(r => {
            const d = Store.getDraft(r.day, r.section);
            const hasReport = !!(d && d.status === 'done' && d.result);
            return `<tr>
              <td><strong>D${r.day}</strong></td>
              <td><span class="section-badge sb-${r.section}">${Records.LABELS[r.section]}</span></td>
              <td style="font-weight:800; color:${Records.bandColor(r.band)}">${r.band != null ? r.band.toFixed(1) : '—'}</td>
              <td>${r.raw != null ? r.raw : '—'}</td>
              <td class="muted">${r.at ? Records.timeAgo(new Date(r.at).getTime()) : '—'}</td>
              <td>${hasReport ? `<button class="btn btn-sm btn-ghost" data-report="${r.day}:${r.section}">${icon('file', 14)} Report</button>` : '<span class="hint">—</span>'}</td>
            </tr>`;
          }).join('')}</tbody></table></div>`;
      }

      function histBlock() {
        if (!hist.length) return '';
        return `<h2 class="section-title">${icon('target', 20)} Mock Exam History</h2>
          <div class="card">
            ${hist.map(h => `
              <div class="mock-hist-row">
                <strong>${esc(h.date)}</strong><span class="hint">Day ${h.startDay}</span>
                <div class="bands">
                  ${['reading', 'writing', 'listening'].map(s =>
                    `<span>${NAME[h] ? '' : ''}${{ reading: 'R', writing: 'W', listening: 'L' }[s]}: ${h.bands && h.bands[s] != null ? h.bands[s].toFixed(1) : '—'}</span>`).join('')}
                </div>
                <span class="ov" style="color:${h.overall != null ? Records.bandColor(h.overall) : 'var(--ink-3)'}">${h.overall != null ? h.overall.toFixed(1) : '—'}</span>
              </div>`).join('')}
          </div>`;
      }

      function render() {
        el.innerHTML = `
          <span class="kicker">Archive</span>
          <h1 class="page-title">Review Center</h1>
          <p class="page-sub">Browse every completed session, reopen saved AI reports, and track your mock-exam history.</p>

          <div style="margin-top:20px">${summaryCards()}</div>

          <h2 class="section-title">${icon('list', 20)} All Sessions <span class="badge badge-navy" style="margin-left:8px">${all.length}</span></h2>
          <div class="rev-filters">
            ${[['all', 'All'], ...Records.SECTIONS.map(s => [s, Records.LABELS[s]])].map(([k, l]) =>
              `<button class="chip ${filter === k ? 'active' : ''}" data-filter="${k}">${l}</button>`).join('')}
          </div>
          <div id="rv-rows">${filteredRows()}</div>

          ${histBlock()}`;

        $$('[data-filter]', el).forEach(b => b.addEventListener('click', () => {
          filter = b.dataset.filter;
          $$('[data-filter]', el).forEach(x => x.classList.toggle('active', x === b));
          $('#rv-rows', el).innerHTML = filteredRows();
          bindReportButtons();
        }));
        bindReportButtons();
      }

      function bindReportButtons() {
        $$('[data-report]', el).forEach(b => b.addEventListener('click', () => {
          const [day, section] = b.dataset.report.split(':');
          openReport(Number(day), section);
        }));
      }

      render();
    }
  };

})();