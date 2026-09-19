/* ============================================================
   IELTS PRO 150 — Writing Bank
   1) Real chart data for ALL 14 Task-1 titles in the study plan
   2) WritingCharts — dependency-free SVG renderer
      (line · bar · pie · table · process · map)
   3) Essay structure guides (per Task-2 type) + theme vocabulary
   Titles are matched EXACTLY to StudyPlan T1_SET strings.
   ============================================================ */

'use strict';

const WritingBank = (() => {

  const PALETTE = ['#16355C', '#C99A2E', '#1E7F5C', '#8E6FC1', '#C0392B', '#3A66A8'];

  /* ==========================================================
     TASK 1 CHART DATA (index-aligned with StudyPlan.T1_SET)
     ========================================================== */
  const CHARTS = [
    { /* 0 */ kind: 'line', title: 'Energy consumption in the UK, 1970–2020', unit: 'million tonnes of oil equivalent',
      xLabels: ['1970', '1980', '1990', '2000', '2010', '2020'],
      series: [
        { name: 'Coal',       values: [140, 118, 65, 37, 18, 5] },
        { name: 'Oil',        values: [78, 80, 77, 75, 70, 62] },
        { name: 'Gas',        values: [25, 45, 50, 90, 82, 68] },
        { name: 'Renewables', values: [0, 1, 1, 3, 9, 42] }
      ] },
    { /* 1 */ kind: 'bar', title: 'Household spending across five countries, 2020', unit: '% of household income',
      groups: ['Housing', 'Food', 'Transport', 'Leisure'],
      series: [
        { name: 'UK',     values: [28, 16, 13, 11] },
        { name: 'Japan',  values: [24, 17, 10, 9] },
        { name: 'Brazil', values: [32, 21, 15, 7] },
        { name: 'Germany',values: [26, 13, 14, 12] },
        { name: 'India',  values: [14, 31, 13, 6] }
      ] },
    { /* 2 */ kind: 'pie', title: 'Water usage by sector, 2004 vs 2024', unit: '%',
      pies: [
        { label: '2004', slices: [ { name: 'Agriculture', value: 62 }, { name: 'Industry', value: 23 }, { name: 'Domestic', value: 15 } ] },
        { label: '2024', slices: [ { name: 'Agriculture', value: 48 }, { name: 'Industry', value: 34 }, { name: 'Domestic', value: 18 } ] }
      ] },
    { /* 3 */ kind: 'table', title: 'International student enrolment in Australia by field, 2010–2020',
      columns: ['Field of study', '2010', '2020', 'Change'],
      rows: [
        { label: 'Business',  values: ['41,200', '52,300', '+27%'] },
        { label: 'Engineering', values: ['18,400', '32,600', '+77%'] },
        { label: 'Information Technology', values: ['12,100', '28,900', '+139%'] },
        { label: 'Health', values: ['9,800', '21,400', '+118%'] },
        { label: 'Education', values: ['7,600', '6,900', '−9%'] }
      ],
      note: 'Figures show full-time international enrolments.' },
    { /* 4 */ kind: 'line', title: 'International tourist arrivals in two island nations, 1995–2015', unit: 'millions of visitors',
      xLabels: ['1995', '2000', '2005', '2010', '2015'],
      series: [
        { name: 'Island A', values: [1.2, 2.4, 3.8, 5.5, 7.1] },
        { name: 'Island B', values: [3.0, 2.8, 2.1, 1.6, 1.9] }
      ] },
    { /* 5 */ kind: 'bar', title: 'Recycling rates in four cities, 2000–2020', unit: '% of household waste recycled',
      groups: ['London', 'Toronto', 'Seoul', 'Berlin'],
      series: [
        { name: '2000', values: [12, 21, 34, 45] },
        { name: '2010', values: [27, 38, 51, 61] },
        { name: '2020', values: [43, 55, 68, 72] }
      ] },
    { /* 6 */ kind: 'process', title: 'The production of cement and concrete',
      steps: [
        { n: 1, text: 'Limestone and clay are crushed together' },
        { n: 2, text: 'The powder is mixed and fed into a rotating kiln' },
        { n: 3, text: 'Heated to about 1,450°C, it becomes clinker' },
        { n: 4, text: 'Clinker is ground with gypsum → cement' },
        { n: 5, text: 'Cement (15%) is mixed with water (10%), sand (25%) and gravel (50%) → concrete' }
      ],
      note: 'Percentages show the composition of the final concrete mix.' },
    { /* 7 */ kind: 'map', title: 'Changes in a city centre between 1980 and the present day',
      thenLabel: 'City centre · 1980', nowLabel: 'City centre · Today',
      thenFeatures: ['Factory beside the river', 'Terraced housing', 'Railway station', 'Market square', 'Unbridged river bank'],
      nowFeatures: ['Business park on the old factory site', 'Modern apartment blocks', 'Tram link to the suburbs', 'Pedestrianised plaza (old market square)', 'Riverside walkway and footbridge'],
      changes: ['Factory → business park', 'Houses → apartments', 'Railway → tram link', 'New riverside walkway'] },
    { /* 8 */ kind: 'table', title: 'Commuting methods in one European capital, 1990 vs 2020',
      columns: ['Method', '1990', '2020', 'Change'],
      rows: [
        { label: 'Car', values: ['48%', '29%', '−19 pts'] },
        { label: 'Public transport', values: ['31%', '41%', '+10 pts'] },
        { label: 'Bicycle', values: ['9%', '19%', '+10 pts'] },
        { label: 'Walking', values: ['10%', '8%', '−2 pts'] },
        { label: 'Other', values: ['2%', '3%', '+1 pt'] }
      ],
      note: 'Share of all commuter journeys.' },
    { /* 9 */ kind: 'line', title: 'Meat consumption per person in three regions, 1985–2025', unit: 'kg per person per year',
      xLabels: ['1985', '1995', '2005', '2015', '2025*'],
      series: [
        { name: 'North America', values: [82, 86, 90, 84, 78] },
        { name: 'Europe', values: [65, 68, 66, 60, 55] },
        { name: 'Asia', values: [12, 18, 26, 33, 38] }
      ] },
    { /* 10 */ kind: 'pie', title: 'Household expenditure in one country in 1975 and 2015', unit: '% of spending',
      pies: [
        { label: '1975', slices: [ { name: 'Food', value: 35 }, { name: 'Housing', value: 18 }, { name: 'Transport', value: 12 }, { name: 'Clothing', value: 10 }, { name: 'Entertainment', value: 5 }, { name: 'Other', value: 20 } ] },
        { label: '2015', slices: [ { name: 'Food', value: 20 }, { name: 'Housing', value: 32 }, { name: 'Transport', value: 15 }, { name: 'Clothing', value: 4 }, { name: 'Entertainment', value: 12 }, { name: 'Other', value: 17 } ] }
      ] },
    { /* 11 */ kind: 'process', title: 'How sugar is produced from sugar cane',
      steps: [
        { n: 1, text: 'Sugar cane is harvested by hand or machine' },
        { n: 2, text: 'Canes are washed and cut into pieces' },
        { n: 3, text: 'Crushing presses extract the raw juice' },
        { n: 4, text: 'Juice is filtered, then heated to evaporate water' },
        { n: 5, text: 'Syrup cools and crystallises' },
        { n: 6, text: 'A centrifuge separates sugar crystals from syrup' },
        { n: 7, text: 'Crystals are dried, graded and packed' }
      ] },
    { /* 12 */ kind: 'bar', title: 'Population growth in three urban areas, 1950–2030 (projected)', unit: 'millions of residents',
      groups: ['1950', '1975', '2000', '2025', '2030*'],
      series: [
        { name: 'Shanghai',  values: [4.3, 6.0, 14.2, 26.0, 27.8] },
        { name: 'São Paulo', values: [2.3, 9.6, 17.8, 22.0, 22.6] },
        { name: 'Lagos',     values: [0.3, 1.9, 7.3, 14.9, 16.0] }
      ] },
    { /* 13 */ kind: 'map', title: 'Redevelopment plans for a harbour area',
      thenLabel: 'Harbour · Current', nowLabel: 'Harbour · Planned',
      thenFeatures: ['Working fishing pier', 'Warehouse district', 'Surface car park', 'Small ferry terminal'],
      nowFeatures: ['Marina for leisure boats', 'Waterfront apartment buildings', 'Technology hub in renovated warehouses', 'Public green park', 'Cycle path along the quay', 'Expanded ferry terminal'],
      changes: ['Fishing pier → marina', 'Warehouses → tech hub + apartments', 'Car park → park + cycle path', 'Ferry terminal doubled in size'] }
  ];

  function task1Data(title) {
    return CHARTS.find(c => c.title === title) || null;
  }
  function kindLabel(kind) {
    return { line: 'line graph', bar: 'bar chart', pie: 'pie chart', table: 'table', process: 'diagram', map: 'maps' }[kind] || 'visual';
  }

  /* ==========================================================
     TASK 2 GUIDES + THEME VOCABULARY
     ========================================================== */
  const ESSAY_GUIDES = {
    'Opinion': {
      structure: ['Introduction — paraphrase the question and state your position clearly (I agree / I disagree / partial).',
        'Body 1 — first reason for your position + explanation + specific example.',
        'Body 2 — second reason / counter-argument + why your position still holds.',
        'Conclusion — restate the position in fresh words; no new ideas.'],
      tips: ['Keep ONE clear position from the first sentence to the last — hedging costs Task Response bands.',
        'Use "To what extent" language: largely / to a large extent / in certain limited cases.']
    },
    'Discussion': {
      structure: ['Introduction — paraphrase both views + state that you will give (or hint) your opinion.',
        'Body 1 — first view: why some people hold it, with support.',
        'Body 2 — opposing view: reasons + support.',
        'Conclusion (or end of Body 2) — your own opinion, clearly weighed.'],
      tips: ['Give each view a fair, objective paragraph before judging — examiners reward balance.',
        'Report views with "Some argue / Others maintain", then commit with "In my view".']
    },
    'Adv/Disadv': {
      structure: ['Introduction — paraphrase + signal that both benefits and drawbacks exist (state which outweigh).',
        'Body 1 — advantages: 2 developed points with examples.',
        'Body 2 — disadvantages: 2 developed points with examples.',
        'Conclusion — final judgement: do advantages outweigh disadvantages?'],
      tips: ['"Do the advantages outweigh" demands a verdict — a neutral list caps you at Band 6.',
        'Compare weight: "While X brings…, the more significant effect is…"']
    },
    'Problem/Solution': {
      structure: ['Introduction — paraphrase the problem statement + outline: causes then measures.',
        'Body 1 — 2 root causes, explained (why do they lead to the problem?).',
        'Body 2 — 2 realistic solutions, matched to the causes above.',
        'Conclusion — brief: problems are serious but solvable if…'],
      tips: ['Match each solution to a named cause — examiners look for that logical link.',
        'Use cause language: stem from / be attributable to / give rise to.']
    },
    'Two-part': {
      structure: ['Introduction — paraphrase and signal you will answer BOTH questions.',
        'Body 1 — full answer to question 1 (reasons / effects), with example.',
        'Body 2 — full answer to question 2, with example.',
        'Conclusion — one-sentence synthesis of both answers.'],
      tips: ['Give the two questions ROUGHLY EQUAL space — imbalance hits Task Response.',
        'Underline the two question words before planning; answer them literally.']
    }
  };

  const THEME_VOCAB = {
    Education: ['curriculum reform', 'academic attainment', 'vocational training', 'lifelong learning', 'rote learning', 'extracurricular activities', 'tuition fees', 'pedagogical'],
    Technology: ['digital literacy', 'automation', 'unprecedented pace of change', 'cyber-security', 'screen time', 'algorithmic decision-making', 'technological dependence'],
    Environment: ['carbon emissions', 'renewable energy', 'sustainable practices', 'ecological footprint', 'biodiversity loss', 'climate mitigation', 'single-use plastics'],
    Health: ['preventative healthcare', 'sedentary lifestyle', 'public health campaign', 'balanced diet', 'mental well-being', 'universal coverage', 'epidemic of obesity'],
    Work: ['job satisfaction', 'career progression', 'work-life balance', 'remote working', 'labour market', 'employee retention', 'gig economy'],
    Society: ['social cohesion', 'ageing population', 'nuclear family', 'intergenerational support', 'community engagement', 'quality of life', 'social mobility'],
    Crime: ['deterrent', 'rehabilitation', 'recidivism rates', 'law enforcement', 'petty crime', 'restorative justice', 'harsh sentencing'],
    Media: ['news outlets', 'misinformation', 'editorial standards', 'social media platforms', 'digital journalism', 'echo chambers', 'freedom of the press'],
    Culture: ['cultural heritage', 'globalisation', 'cultural identity', 'intangible traditions', 'homogenisation', 'heritage preservation', 'multiculturalism'],
    Transport: ['public transit', 'congestion charging', 'commuting patterns', 'infrastructure investment', 'low-emission zones', 'urban sprawl'],
    Cities: ['urbanisation', 'affordable housing', 'metropolitan area', 'inner-city regeneration', 'green spaces', 'overcrowding', 'zoning regulations']
  };

  function essayGuide(type) { return ESSAY_GUIDES[type] || ESSAY_GUIDES['Opinion']; }
  function themeVocab(theme) { return THEME_VOCAB[theme] || []; }

  /* ==========================================================
     SVG CHART RENDERER
     ========================================================== */
  const esc = window.esc;

  function niceTicks(min, max, count = 4) {
    const span = max - min || 1;
    const step0 = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  }
  const fmtTick = t => (Math.round(t * 100) / 100).toLocaleString();

  function legendHTML(series) {
    return `<div class="chart-legend">${series.map((s, i) =>
      `<span><i style="background:${PALETTE[i % PALETTE.length]}"></i>${esc(s.name)}</span>`).join('')}</div>`;
  }
  function chartTitleHTML(title) { return `<div class="chart-title">${esc(title)}</div>`; }

  function renderLine(d) {
    const w = 680, h = 350, pl = 60, pr = 18, pt = 22, pb = 50;
    const vals = d.series.flatMap(s => s.values);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.14; lo = Math.max(0, lo - pad); hi = hi + pad;
    const n = d.xLabels.length;
    const X = i => pl + (n === 1 ? (w - pl - pr) / 2 : i * ((w - pl - pr) / (n - 1)));
    const Y = v => pt + (1 - (v - lo) / (hi - lo)) * (h - pt - pb);
    let g = '';
    niceTicks(lo, hi, 4).forEach(t => {
      const yy = Y(t).toFixed(1);
      g += `<line x1="${pl}" x2="${w - pr}" y1="${yy}" y2="${yy}" style="stroke:var(--line)"/>`;
      g += `<text x="${pl - 8}" y="${Number(yy) + 4}" text-anchor="end" font-size="11" style="fill:var(--ink-3)">${fmtTick(t)}</text>`;
    });
    const skip = Math.ceil(n / 9);
    d.xLabels.forEach((l, i) => {
      if (i % skip === 0 || i === n - 1)
        g += `<text x="${X(i).toFixed(1)}" y="${h - 26}" text-anchor="middle" font-size="11" style="fill:var(--ink-3)">${esc(l)}</text>`;
    });
    g += `<line x1="${pl}" x2="${pl}" y1="${pt}" y2="${h - pb}" style="stroke:var(--line-strong)"/>`;
    g += `<line x1="${pl}" x2="${w - pr}" y1="${h - pb}" y2="${h - pb}" style="stroke:var(--line-strong)"/>`;
    if (d.unit) g += `<text x="${pl - 46}" y="${pt - 8}" font-size="10.5" style="fill:var(--ink-3)">${esc(d.unit)}</text>`;
    d.series.forEach((s, si) => {
      const c = PALETTE[si % PALETTE.length];
      const pts = s.values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
      g += `<polyline points="${pts}" fill="none" style="stroke:${c}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`;
      s.values.forEach((v, i) => {
        g += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3.4" style="fill:${c};stroke:var(--surface)" stroke-width="1.4"><title>${esc(s.name)} — ${esc(d.xLabels[i])}: ${v}</title></circle>`;
      });
    });
    return chartTitleHTML(d.title) + `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(d.title)}">${g}</svg>` + legendHTML(d.series);
  }

  function renderBar(d) {
    const w = 680, h = 360, pl = 60, pr = 18, pt = 22, pb = 78;
    const vals = d.series.flatMap(s => s.values);
    let hi = Math.max(...vals), lo = Math.min(0, Math.min(...vals));
    hi += (hi - lo) * 0.12;
    const groups = d.groups, gn = groups.length, sn = d.series.length;
    const gw = (w - pl - pr) / gn;
    const barW = Math.min(34, (gw * 0.72) / sn);
    const Y = v => pt + (1 - (v - lo) / (hi - lo)) * (h - pt - pb);
    let g = '';
    niceTicks(lo, hi, 4).forEach(t => {
      const yy = Y(t).toFixed(1);
      g += `<line x1="${pl}" x2="${w - pr}" y1="${yy}" y2="${yy}" style="stroke:var(--line)"/>`;
      g += `<text x="${pl - 8}" y="${Number(yy) + 4}" text-anchor="end" font-size="11" style="fill:var(--ink-3)">${fmtTick(t)}</text>`;
    });
    groups.forEach((gl, gi) => {
      const cx = pl + gw * gi + gw / 2;
      g += `<text x="${cx.toFixed(1)}" y="${h - 56}" text-anchor="middle" font-size="11.5" font-weight="600" style="fill:var(--ink-2)">${esc(gl)}</text>`;
      const totalW = barW * sn + (sn - 1) * 3;
      d.series.forEach((s, si) => {
        const v = s.values[gi];
        const bx = cx - totalW / 2 + si * (barW + 3);
        const by = Y(v);
        g += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, h - pb - by).toFixed(1)}" rx="3" style="fill:${PALETTE[si % PALETTE.length]}"><title>${esc(s.name)} — ${esc(gl)}: ${v}</title></rect>`;
      });
    });
    g += `<line x1="${pl}" x2="${pl}" y1="${pt}" y2="${h - pb}" style="stroke:var(--line-strong)"/>`;
    g += `<line x1="${pl}" x2="${w - pr}" y1="${h - pb}" y2="${h - pb}" style="stroke:var(--line-strong)"/>`;
    if (d.unit) g += `<text x="${pl - 46}" y="${pt - 8}" font-size="10.5" style="fill:var(--ink-3)">${esc(d.unit)}</text>`;
    return chartTitleHTML(d.title) + `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(d.title)}">${g}</svg>` + legendHTML(d.series);
  }

  function pieArc(cx, cy, r, a0, a1) {
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
  }

  function renderPie(d) {
    const w = 680, h = 300, r = 100;
    const pies = d.pies || [{ label: '', slices: d.slices || [] }];
    const cxs = pies.length === 2 ? [w * 0.3, w * 0.7] : [w * 0.5];
    let g = '';
    pies.forEach((p, pi) => {
      const cx = cxs[pi], cy = h / 2 - 10;
      const total = p.slices.reduce((s, x) => s + x.value, 0) || 1;
      let a = -Math.PI / 2;
      p.slices.forEach((sl, si) => {
        const a1 = a + (sl.value / total) * Math.PI * 2;
        g += `<path d="${pieArc(cx, cy, r, a + 0.012, a1 - 0.012)}" style="fill:${PALETTE[si % PALETTE.length]}"><title>${esc(sl.name)}: ${sl.value}${esc(d.unit || '')}</title></path>`;
        const share = sl.value / total;
        if (share >= 0.06) {
          const mid = (a + a1) / 2, lr = r * 0.62;
          g += `<text x="${(cx + lr * Math.cos(mid)).toFixed(1)}" y="${(cy + lr * Math.sin(mid) + 4).toFixed(1)}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#fff">${Math.round(share * 100)}%</text>`;
        }
        a = a1;
      });
      if (p.label) g += `<text x="${cx}" y="${cy + r + 28}" text-anchor="middle" font-size="12.5" font-weight="700" style="fill:var(--ink)">${esc(p.label)}</text>`;
    });
    return chartTitleHTML(d.title) + `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(d.title)}">${g}</svg>` + legendHTML(pies[0].slices.map(s => ({ name: s.name })));
  }

  function renderTable(d) {
    return chartTitleHTML(d.title) +
      `<div class="table-wrap"><table class="table">
        <thead><tr>${d.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${d.rows.map(r => `<tr><td style="font-weight:700; color:var(--ink)">${esc(r.label)}</td>${r.values.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>` + (d.note ? `<p class="hint" style="margin-top:8px">${esc(d.note)}</p>` : '');
  }

  function renderProcess(d) {
    return chartTitleHTML(d.title) +
      `<div class="proc-flow">${d.steps.map((s, i) =>
        `<div class="proc-step"><span class="proc-n">${s.n}</span><span>${esc(s.text)}</span></div>` +
        (i < d.steps.length - 1 ? '<span class="proc-arrow">→</span>' : '')
      ).join('')}</div>` + (d.note ? `<p class="hint" style="margin-top:12px">${esc(d.note)}</p>` : '');
  }

  function renderMap(d) {
    const list = items => `<ul class="map-list">${items.map(t =>
      `<li>${icon('check', 14)}<span>${esc(t)}</span></li>`).join('')}</ul>`;
    return chartTitleHTML(d.title) +
      `<div class="map-compare">
        <div class="map-panel"><h5>${esc(d.thenLabel)}</h5>${list(d.thenFeatures)}</div>
        <div class="map-panel map-now"><h5>${esc(d.nowLabel)}</h5>${list(d.nowFeatures)}</div>
      </div>` +
      (d.changes ? `<div class="map-changes"><h5>Key changes</h5><div class="chips">${d.changes.map(c =>
        `<span class="chip" style="cursor:default">${icon('arrow-right', 13)} ${esc(c)}</span>`).join('')}</div></div>` : '');
  }

  function render(d) {
    if (!d) return '<p class="hint">Visual unavailable.</p>';
    switch (d.kind) {
      case 'line': return renderLine(d);
      case 'bar': return renderBar(d);
      case 'pie': return renderPie(d);
      case 'table': return renderTable(d);
      case 'process': return renderProcess(d);
      case 'map': return renderMap(d);
      default: return '<p class="hint">Unknown visual type.</p>';
    }
  }

  return { PALETTE, task1Data, kindLabel, essayGuide, themeVocab, render };
})();