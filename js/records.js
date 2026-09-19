/* ============================================================
   IELTS PRO 150 — Records
   Shared history/analytics layer used by Dashboard & Progress.
   Flattens Store progress into sessions, averages, trends.
   ============================================================ */

'use strict';

const Records = (() => {

  const SECTIONS = ['reading', 'writing', 'listening'];
  const LABELS   = { reading: 'Reading', writing: 'Writing', listening: 'Listening' };
  const COLORS   = {
    reading: 'var(--primary-600)',
    writing: 'var(--accent)',
    listening: 'var(--success)',
    overall: '#8E6FC1'
  };

  /* ---------- Flat session list ---------- */
  function sessions() {
    const p = Store.getProgress();
    const out = [];
    Object.keys(p.days).forEach(k => {
      const day = Number(k);
      const rec = p.days[k];
      SECTIONS.forEach(s => {
        const r = rec && rec[s];
        if (r && r.completed) {
          out.push({
            day, section: s,
            band: typeof r.band === 'number' ? r.band : null,
            raw: typeof r.raw === 'number' ? r.raw : null,
            at: r.completedAt || null
          });
        }
      });
    });
    out.sort((a, b) => (a.at && b.at) ? new Date(a.at) - new Date(b.at) : a.day - b.day);
    return out;
  }

  function lastSessions(n = 6) { return sessions().slice(-n).reverse(); }

  /* ---------- Averages per section ---------- */
  function sectionAverages() {
    const sums = {}, counts = {};
    SECTIONS.forEach(s => { sums[s] = 0; counts[s] = 0; });
    sessions().forEach(x => {
      if (x.band != null) { sums[x.section] += x.band; counts[x.section]++; }
    });
    const avg = s => counts[s] ? Math.round((sums[s] / counts[s]) * 10) / 10 : null;
    const vals = SECTIONS.map(avg).filter(v => v != null);
    return {
      reading: avg('reading'),
      writing: avg('writing'),
      listening: avg('listening'),
      overall: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null
    };
  }

  /* ---------- Trend points for the line chart ---------- */
  function trend(sectionKey = null, limit = 30) {
    const all = sessions().filter(x => x.band != null);

    if (sectionKey) {
      return all.filter(x => x.section === sectionKey)
                .slice(-limit)
                .map(x => ({ label: 'D' + x.day, y: x.band }));
    }
    /* Daily overall average across sections */
    const byDay = {};
    all.forEach(x => { (byDay[x.day] = byDay[x.day] || []).push(x.band); });
    return Object.keys(byDay)
                 .map(d => ({ day: Number(d), band: byDay[d].reduce((a, b) => a + b, 0) / byDay[d].length }))
                 .sort((a, b) => a.day - b.day)
                 .slice(-limit)
                 .map(p => ({ label: 'D' + p.day, y: Math.round(p.band * 10) / 10 }));
  }

  /* ---------- 150-day calendar map ---------- */
  function calendar() {
    const p = Store.getProgress();
    const cells = [];
    for (let d = 1; d <= CONFIG.TOTAL_DAYS; d++) {
      const rec = p.days[d];
      const done = SECTIONS.filter(s => rec && rec[s] && rec[s].completed).length;
      cells.push({
        day: d, done,
        complete: done === 3,
        partial: done > 0 && done < 3,
        current: d === p.currentDay,
        future: d > p.currentDay
      });
    }
    return cells;
  }

  /* ---------- Helpers ---------- */
  function bandColor(b) {
    if (b == null) return 'var(--ink-3)';
    if (b >= 8) return 'var(--success)';
    if (b >= 7) return 'var(--primary-600)';
    if (b >= 6) return 'var(--accent)';
    return 'var(--warn)';
  }

  function timeAgo(ts) {
    if (!ts) return '';
    const m = Math.floor((Date.now() - Number(ts)) / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  }

  /* ---------- CSV export ---------- */
  function toCSV() {
    const rows = [['day', 'section', 'band', 'raw', 'completedAt']];
    sessions().forEach(s => rows.push([s.day, s.section, s.band != null ? s.band : '', s.raw != null ? s.raw : '', s.at || '']));
    return rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  }

  return { SECTIONS, LABELS, COLORS, sessions, lastSessions, sectionAverages, trend, calendar, bandColor, timeAgo, toCSV };
})();