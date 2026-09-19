/* ============================================================
   IELTS PRO 150 — Dashboard (full version, replaces Batch-1 mini)
   Today's mission · draft resume · last-7-days strip ·
   recent results · AI Coach (live OpenRouter call)
   ============================================================ */

'use strict';

window.Views = window.Views || {};

(function () {

  /* ---------- Deterministic daily focus tips ---------- */
  const FOCUS_TIPS = [
    'True/False/Not Given: find the exact sentence first — the answer lives in the passage, never in outside knowledge.',
    'Writing Task 1: put a clear overview right after the introduction — examiners cannot award Band 7+ without one.',
    'Listening: use the preview time to underline keywords and predict the answer type — number, name, or noun?',
    'IELTS rarely repeats question wording: train spotting paraphrases and synonyms in both Reading and Listening.',
    'In fill-in answers, write only the required words — one extra word is marked wrong even if the meaning is right.',
    'Task 2: spend 5 minutes planning position, two main ideas and one example each — planning is what makes Band 8 coherence possible.',
    'Check spelling on every answer you transfer; a correct word with wrong spelling scores zero.',
    'Link ideas with referencing ("this trend", "such measures") instead of mechanical First/Second connectors.',
    'Skim each Reading passage for 90 seconds first — title, opening lines, proper nouns — to build a mental map.',
    'Collect 10 collocations from your AI feedback reports and force three of them into your next essay.'
  ];

  /* ---------- Section status ---------- */
  function statusFor(section, plan) {
    if (Store.isSectionDone(plan.day, section)) return 'done';
    return Store.getDraft(plan.day, section) ? 'draft' : 'todo';
  }

  /* ---------- Today's mission card ---------- */
  function sectionCard(section, plan) {
    const meta = {
      reading: {
        icon: 'book', cls: 'navy', title: 'Reading · 60 min',
        sub: `${plan.reading.passages} passages · ${plan.reading.questions} questions · ${plan.reading.words} words<br>${esc(plan.reading.topic)}`
      },
      writing: {
        icon: 'pen', cls: 'gold', title: 'Writing · 60 min',
        sub: `<strong>${esc(plan.writing.task1.type)}</strong> — ${esc(plan.writing.task1.title)}<br>` +
             `<strong>${esc(plan.writing.task2.type)}</strong> — ${esc(plan.writing.task2.theme)}<br>` +
             `<span class="muted">${plan.writing.task1.minWords}+ / ${plan.writing.task2.minWords}+ words · AI band scoring</span>`
      },
      listening: {
        icon: 'headphones', cls: 'green', title: 'Listening · 30 min',
        sub: `${esc(plan.listening.sections[0].scenario)} → ${esc(plan.listening.sections[3].scenario)}<br>` +
             `<span class="muted">4 sections · ${plan.listening.questions} questions</span>`
      }
    }[section];

    const st    = statusFor(section, plan);
    const rec   = Store.dayRecord(plan.day);
    const band  = rec && rec[section] && rec[section].band;
    const draft = Store.getDraft(plan.day, section);

    let action;
    if (st === 'done') {
      action = `<span class="badge badge-green" style="margin-right:8px">${icon('check', 13)} ${band != null ? 'Band ' + band : 'Done'}</span>` +
               `<button class="btn btn-sm btn-ghost" data-go="${section}">${icon('refresh', 14)} Revisit</button>`;
    } else if (st === 'draft') {
      action = `<button class="btn btn-sm btn-accent" data-go="${section}">${icon('play', 14)} Resume draft</button>` +
               `<span class="hint" style="margin-left:8px">saved ${Records.timeAgo(draft.savedAt)}</span>`;
    } else {
      action = `<button class="btn btn-sm btn-primary" data-go="${section}">${icon('play', 14)} Start</button>`;
    }

    return `
      <div class="plan-item ${st === 'done' ? 'done' : ''}">
        <div class="stat-icon ${meta.cls}">${icon(meta.icon, 20)}</div>
        <div>
          <h4>${meta.title}</h4>
          <p>${meta.sub}</p>
        </div>
        <div style="margin-left:auto; display:flex; align-items:center">${action}</div>
      </div>`;
  }

  /* ---------- Last-7-days strip ---------- */
  function dayStrip(plan) {
    const cells = Records.calendar().filter(c => c.day >= plan.day - 6 && c.day <= plan.day);
    return `<div class="day-strip">${cells.map(c => {
      const cls = [c.complete ? 'done' : '', c.partial ? 'partial' : '', c.current ? 'today' : ''].join(' ');
      const state = c.complete ? 'Complete' : (c.partial ? 'Partial' : '—');
      return `<div class="day-cell ${cls}"><strong>D${c.day}</strong><small>${c.current ? 'Today' : state}</small></div>`;
    }).join('')}</div>`;
  }

  /* ---------- Phase roadmap ---------- */
  function phaseBar(plan) {
    return `<div class="legend" style="margin-top:0">${StudyPlan.PHASES.map(p => {
      const active = plan.phase.id === p.id;
      return `<span><i style="background:${active ? 'var(--accent)' : 'var(--line-strong)'}"></i>` +
             `${p.name} (D${p.from}–D${p.to})${active ? ' · now' : ''}</span>`;
    }).join('')}</div>`;
  }

  /* ---------- Recent results ---------- */
  function recentTable() {
    const rows = Records.lastSessions(6);
    if (!rows.length) {
      return `<div class="empty-state" style="padding:34px 18px">
        ${icon('chart', 34)}
        <h3>No sessions yet</h3>
        <p>Complete your first section to start building your band history.</p>
      </div>`;
    }
    return `<div class="table-wrap"><table class="table">
      <thead><tr><th>Day</th><th>Section</th><th>Band</th><th>Raw</th><th>When</th><th></th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><strong>D${r.day}</strong></td>
        <td><span class="section-badge sb-${r.section}">${Records.LABELS[r.section]}</span></td>
        <td style="font-weight:800; color:${Records.bandColor(r.band)}">${r.band != null ? r.band.toFixed(1) : '—'}</td>
        <td>${r.raw != null ? r.raw : '—'}</td>
        <td class="muted">${Records.timeAgo(new Date(r.at).getTime())}</td>
        <td><button class="btn btn-sm btn-ghost" data-go="${r.section}">Open</button></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  /* ---------- Coach card ---------- */
  function coachCard(plan) {
    const tip = FOCUS_TIPS[(plan.day - 1) % FOCUS_TIPS.length];
    return `
      <div class="card">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px">
          <div class="stat-icon gold" style="width:42px; height:42px">${icon('spark', 20)}</div>
          <div>
            <h3 style="font-family:var(--font-head); font-size:16px">AI Coach — today's focus</h3>
            <span class="hint">Examiner Ada · ${esc(AI.currentModel())}</span>
          </div>
        </div>
        <p class="coach-focus">${esc(tip)}</p>
        <button class="btn btn-primary btn-block" id="coachBtn" style="margin-top:16px">${icon('spark', 16)} Ask the AI Coach</button>
        <p class="hint center" style="margin-top:10px">Personalised guidance from your real stats. Practice feedback — not an official IELTS score.</p>
      </div>`;
  }

  /* ---------- AI Coach modal (live AI call) ---------- */
  async function openCoach(plan, st, avgs) {
    const m = Modal.open({
      title: 'AI Coach',
      width: 540,
      body: `<div class="ai-working"><span class="spinner"></span><span class="status-line">Contacting Examiner Ada…</span></div><div class="ai-result"></div>`
    });
    const statusEl = $('.status-line', m.el);
    const resultEl = $('.ai-result', m.el);

    const ctx = {
      day: plan.day,
      phase: plan.phase.name,
      targetBand: CONFIG.TARGET_BAND,
      averages: avgs,
      totals: { sectionsDone: st.sectionsDone, streak: st.streak, bestStreak: st.bestStreak },
      today: {
        readingTopic: plan.reading.topic,
        task1: plan.writing.task1.type + ' — ' + plan.writing.task1.title,
        essayTheme: plan.writing.task2.theme
      }
    };

    try {
      if (statusEl) statusEl.textContent = 'Analyzing your journey…';
      const r = await AI.requestJSON(Prompts.coach(ctx));
      resultEl.innerHTML = `
        <div class="fb-block"><h4>${icon('target', 16)} Today's focus</h4><p>${esc(r.focus || '')}</p></div>
        ${r.why ? `<div class="fb-block"><h4>${icon('info', 16)} Why</h4><p>${esc(r.why)}</p></div>` : ''}
        <div class="fb-block"><h4>${icon('spark', 16)} Technique</h4><p>${esc(r.tip || '')}</p></div>
        ${Array.isArray(r.drills) && r.drills.length
          ? `<div class="fb-block"><h4>${icon('list', 16)} Today's drills</h4><ul>${r.drills.map(d => `<li>${esc(d)}</li>`).join('')}</ul></div>` : ''}
        ${r.motivation ? `<div class="fb-block"><h4>${icon('flame', 16)} Motivation</h4><p>${esc(r.motivation)}</p></div>` : ''}
        <p class="hint center" style="margin-top:12px">AI guidance for practice only — not an official IELTS assessment.</p>`;
    } catch (e) {
      resultEl.innerHTML = `
        <div class="fb-block">
          <h4>${icon('alert', 16)} Coach unavailable</h4>
          <p>${esc(e.message)}</p>
          <p class="hint">Set OPENROUTER_API_KEY on Netlify, or paste a development key in Settings → OpenRouter API key.</p>
        </div>`;
    }
  }

  /* ---------- View registration ---------- */
  window.Views.dashboard = {
    mount(el) {
      const p    = Store.getProgress();
      const plan = StudyPlan.getDayPlan(p.currentDay);
      const st   = Store.stats();
      const avgs = Records.sectionAverages();
      const pct  = st.overallPercent;

      el.innerHTML = `
        <div class="hero">
          <div style="flex:1; min-width:260px">
            <span class="kicker">${plan.isMock ? 'Mock Simulation Day' : esc(plan.phase.name) + ' Phase'} · Day ${plan.day} of ${CONFIG.TOTAL_DAYS}</span>
            <h1 class="hero-title">${plan.isMock ? 'Full 3-section simulation' : 'Today\u2019s training session'}</h1>
            <p class="hero-sub">${esc(plan.phase.focus)}${plan.isMock ? ' — exam conditions: strict timing, no pauses.' : ''}</p>
            <div style="margin-top:16px">${phaseBar(plan)}</div>
          </div>
          <div class="hero-right">
            ${ringSVG(pct / 100, { size: 120, label: pct + '%', sub: 'journey', color: 'var(--accent)' })}
            <div class="hero-meta">
              <div><strong>${st.sectionsDone}</strong><span>Sessions</span></div>
              <div><strong>${st.streak}</strong><span>Streak</span></div>
              <div><strong>${avgs.overall != null ? avgs.overall.toFixed(1) : '—'}</strong><span>Avg band</span></div>
            </div>
          </div>
        </div>

        <h2 class="section-title">${icon('list', 20)} Today's Mission <span class="badge badge-navy" style="margin-left:8px">${plan.day}/150</span></h2>
        <div class="grid" style="gap:12px">
          ${sectionCard('reading', plan)}
          ${sectionCard('writing', plan)}
          ${sectionCard('listening', plan)}
        </div>

        <h2 class="section-title">${icon('calendar', 20)} Last 7 Days</h2>
        ${dayStrip(plan)}

        <div class="grid grid-2" style="margin-top:8px">
          <div>
            <h2 class="section-title">${icon('chart', 20)} Recent Results</h2>
            ${recentTable()}
          </div>
          <div>
            <h2 class="section-title">${icon('spark', 20)} Coach</h2>
            ${coachCard(plan)}
          </div>
        </div>`;

      $$('[data-go]', el).forEach(b => b.addEventListener('click', () => Router.go(b.dataset.go)));
      const cb = $('#coachBtn', el);
      if (cb) cb.addEventListener('click', () => openCoach(plan, st, avgs));
    }
  };

})();