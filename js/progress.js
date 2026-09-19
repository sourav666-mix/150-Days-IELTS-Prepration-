/* ============================================================
   IELTS PRO 150 — Progress & Analytics View
   Score rings · stat cards · SVG band-trend chart with
   section toggles · skill averages vs target · 150-day map ·
   session history + CSV export
   ============================================================ */

'use strict';

window.Views = window.Views || {};

(function () {

  /* ---------- Dependency-free SVG line chart ---------- */
  function lineChart(series) {
    const w = 680, h = 240, pl = 36, pr = 14, pt = 14, pb = 28;
    const n = Math.max(...series.map(s => s.points.length));
    if (!n) return '';

    const yMin = 4, yMax = 9;
    const x = i => pl + (n === 1 ? (w - pl - pr) / 2 : i * ((w - pl - pr) / (n - 1)));
    const y = v => pt + (1 - (clamp(v, yMin, yMax) - yMin) / (yMax - yMin)) * (h - pt - pb);

    let g = '';
    [4, 5, 6, 7, 8, 9].forEach(b => {
      const yy = y(b).toFixed(1);
      g += `<line x1="${pl}" x2="${w - pr}" y1="${yy}" y2="${yy}" style="stroke:var(--line)" stroke-width="1" ${b === 8 ? 'stroke-dasharray="5 4"' : ''}/>`;
      g += `<text x="${pl - 7}" y="${Number(yy) + 3.5}" text-anchor="end" font-size="10.5" style="fill:var(--ink-3)">${b}</text>`;
    });
    g += `<text x="${w - pr}" y="${(y(8) - 5).toFixed(1)}" text-anchor="end" font-size="9.5" font-weight="700" style="fill:var(--ink-3)">TARGET 8.0</text>`;

    const withPts = series.find(s => s.points.length);
    if (withPts) {
      const labels = withPts.points.map(p => p.label);
      const step = Math.ceil(labels.length / 8);
      labels.forEach((l, i) => {
        if (i % step === 0 || i === labels.length - 1) {
          g += `<text x="${x(i).toFixed(1)}" y="${h - 9}" text-anchor="middle" font-size="10.5" style="fill:var(--ink-3)">${esc(l)}</text>`;
        }
      });
    }

    series.forEach(s => {
      if (!s.points.length) return;
      const pts = s.points.map((p, i) => `${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
      g += `<polyline points="${pts}" fill="none" style="stroke:${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
      s.points.forEach((p, i) => {
        g += `<circle cx="${x(i).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="3.6" style="fill:${s.color}; stroke:var(--surface)" stroke-width="1.5">` +
             `<title>${esc(s.name)} — ${esc(p.label)}: Band ${p.y}</title></circle>`;
      });
    });

    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%; height:auto; display:block" role="img" aria-label="Band score trend">${g}</svg>`;
  }

  /* ---------- Stat cards row ---------- */
  function statRow(st) {
    return `<div class="grid grid-3">
      <div class="card stat-card"><div class="stat-icon navy">${icon('check', 20)}</div><div><strong>${st.sectionsDone}</strong><span>Sessions completed</span></div></div>
      <div class="card stat-card"><div class="stat-icon gold">${icon('flame', 20)}</div><div><strong>${st.streak} / ${st.bestStreak}</strong><span>Streak now / best</span></div></div>
      <div class="card stat-card"><div class="stat-icon green">${icon('calendar', 20)}</div><div><strong>Day ${st.currentDay}</strong><span>of ${CONFIG.TOTAL_DAYS}</span></div></div>
    </div>`;
  }

  /* ---------- Skill averages vs Band 8 ---------- */
  function skillsCard(avgs) {
    const rows = Records.SECTIONS.map(s => {
      const v = avgs[s];
      const wpct = v != null ? clamp((v / 9) * 100, 0, 100) : 0;
      return `<div class="skill-row">
        <span class="skill-name">${Records.LABELS[s]}</span>
        <div class="skill-track">
          <div class="skill-fill" style="width:${wpct}%; background:${Records.COLORS[s]}"></div>
          <span class="skill-target" style="left:${((8 / 9) * 100).toFixed(1)}%" title="Band 8.0 target"></span>
        </div>
        <span class="skill-val" style="color:${v != null ? Records.bandColor(v) : 'var(--ink-3)'}">${v != null ? v.toFixed(1) : '—'}</span>
      </div>`;
    }).join('');
    return `<div class="card">
      <h3 style="font-family:var(--font-head); margin-bottom:10px">Skill Averages vs Band 8 Target</h3>
      ${rows}
      <p class="hint" style="margin-top:12px">The dark marker is your Band 8.0 target. Averages update as sessions complete.</p>
    </div>`;
  }

  /* ---------- 150-day calendar map ---------- */
  function calendarCard() {
    const cells = Records.calendar();
    const doneCount = cells.filter(c => c.complete).length;
    return `<div class="card" style="margin-top:34px">
      <div style="display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:8px">
        <h3 style="font-family:var(--font-head)">150-Day Journey Map</h3>
        <span class="hint">${doneCount} day${doneCount === 1 ? '' : 's'} fully completed</span>
      </div>
      <div class="cal-grid" style="margin-top:14px">
        ${cells.map(c => `<div class="cal-cell ${c.complete ? 'complete' : ''} ${c.partial ? 'partial' : ''} ${c.future ? 'future' : ''} ${c.current ? 'current' : ''}"
          title="Day ${c.day} — ${c.complete ? 'all sections done' : (c.partial ? 'partially done' : 'not started yet')}">${c.day}</div>`).join('')}
      </div>
      <div class="legend">
        <span><i style="background:var(--primary)"></i>All 3 done</span>
        <span><i style="background:var(--accent-soft); border:1px solid var(--accent)"></i>Partial</span>
        <span><i style="background:var(--surface-2); border:1px solid var(--line-strong)"></i>Not started</span>
        <span><i style="background:transparent; border:2px solid var(--accent)"></i>Today</span>
      </div>
    </div>`;
  }

  /* ---------- Session history + CSV ---------- */
  function sessionsCard() {
    const rows = Records.sessions().slice(-30).reverse();
    return `<div class="card" style="margin-top:34px">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px">
        <h3 style="font-family:var(--font-head)">Session History</h3>
        <button class="btn btn-sm btn-ghost" id="csvBtn">${icon('download', 15)} Export CSV</button>
      </div>
      ${rows.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Day</th><th>Section</th><th>Band</th><th>Raw</th><th>Completed</th><th></th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td><strong>D${r.day}</strong></td>
          <td><span class="section-badge sb-${r.section}">${Records.LABELS[r.section]}</span></td>
          <td style="font-weight:800; color:${Records.bandColor(r.band)}">${r.band != null ? r.band.toFixed(1) : '—'}</td>
          <td>${r.raw != null ? r.raw : '—'}</td>
          <td class="muted">${r.at ? new Date(r.at).toLocaleDateString() : '—'}</td>
          <td><button class="btn btn-sm btn-ghost" data-go="${r.section}">Open</button></td>
        </tr>`).join('')}</tbody>
      </table></div>` : `
      <div class="empty-state" style="padding:36px 18px">
        ${icon('file', 34)}
        <h3>No sessions yet</h3>
        <p>Your completed Reading, Writing and Listening sessions will appear here.</p>
      </div>`}
    </div>`;
  }

  /* ---------- View registration ---------- */
  let trendKey = 'all';

  window.Views.progress = {
    mount(el) {
      const st   = Store.stats();
      const avgs = Records.sectionAverages();
      const pct  = st.overallPercent;
      const readiness = avgs.overall != null ? clamp(avgs.overall / CONFIG.TARGET_BAND, 0, 1) : 0;

      el.innerHTML = `
        <span class="kicker">Analytics</span>
        <h1 class="page-title">Progress &amp; Performance</h1>
        <p class="page-sub">Every completed session feeds these charts. Keep the trend climbing toward Band 8.</p>

        <div class="card ring-row" style="margin-top:22px">
          ${ringSVG(pct / 100, { size: 120, label: pct + '%', sub: 'journey done', color: 'var(--primary-600)' })}
          ${ringSVG(avgs.overall != null ? avgs.overall / 9 : 0,
                    { size: 120, label: avgs.overall != null ? avgs.overall.toFixed(1) : '—', sub: 'avg band / 9', color: 'var(--accent)' })}
          ${ringSVG(readiness, { size: 120, label: Math.round(readiness * 100) + '%', sub: 'Band 8 readiness', color: 'var(--success)' })}
        </div>

        <div style="margin-top:22px">${statRow(st)}</div>

        <div class="grid progress-split" style="margin-top:34px">
          <div class="card">
            <h3 style="font-family:var(--font-head); margin-bottom:12px">Band Trend</h3>
            <div class="trend-toggle" id="trendToggle">
              ${[['all', 'Overall'], ...Records.SECTIONS.map(s => [s, Records.LABELS[s]])].map(([k, l], i) =>
                `<button class="chip ${i === 0 ? 'active' : ''}" data-trend="${k}">${l}</button>`).join('')}
            </div>
            <div id="trendHost"></div>
            <div class="legend">
              <span><i style="background:${Records.COLORS.overall}"></i>Overall daily average</span>
              <span><i style="background:${Records.COLORS.reading}"></i>Reading</span>
              <span><i style="background:var(--accent)"></i>Writing</span>
              <span><i style="background:var(--success)"></i>Listening</span>
            </div>
          </div>
          ${skillsCard(avgs)}
        </div>

        ${calendarCard()}
        ${sessionsCard()}`;

      /* ----- Trend rendering ----- */
      function renderTrend() {
        const host = $('#trendHost', el);
        const key = trendKey === 'all' ? null : trendKey;
        const pts = Records.trend(key, 30);
        if (pts.length < 2) {
          host.innerHTML = `<div class="empty-state" style="padding:40px 20px">
            ${icon('chart', 36)}
            <h3>Not enough data yet</h3>
            <p>Complete at least two sessions and your band trend will appear here.</p>
          </div>`;
          return;
        }
        host.innerHTML = lineChart([{
          name: trendKey === 'all' ? 'Overall daily average' : Records.LABELS[trendKey],
          color: trendKey === 'all' ? Records.COLORS.overall : Records.COLORS[trendKey],
          points: pts
        }]);
      }

      $$('[data-trend]', el).forEach(b => b.addEventListener('click', () => {
        trendKey = b.dataset.trend;
        $$('[data-trend]', el).forEach(x => x.classList.toggle('active', x === b));
        renderTrend();
      }));
      renderTrend();

      /* ----- CSV export ----- */
      $('#csvBtn', el).addEventListener('click', () => {
        if (!Records.sessions().length) { toast('Nothing to export yet — complete a session first.', 'warn'); return; }
        downloadFile(`ielts-progress-${todayISO()}.csv`, Records.toCSV(), 'text/csv');
        toast('CSV exported.', 'success');
      });

      /* ----- Open buttons ----- */
      $$('[data-go]', el).forEach(b => b.addEventListener('click', () => Router.go(b.dataset.go)));
    }
  };

})();