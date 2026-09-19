/* ============================================================
   IELTS PRO 150 — Storage Engine (localStorage, no login)
   Progress · streaks · per-day records · exam drafts · settings
   ============================================================ */

'use strict';

const Store = (() => {
  const K = {
    PROGRESS: CONFIG.STORAGE_PREFIX + 'progress',
    SETTINGS: CONFIG.STORAGE_PREFIX + 'settings',
    DRAFT:    CONFIG.STORAGE_PREFIX + 'draft'
  };

  const SECTIONS = ['reading', 'writing', 'listening'];

  const read  = (k, f) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

  /* ---------- Progress ---------- */
  function freshProgress() {
    return {
      startDate: todayISO(),
      currentDay: 1,
      streak: 0,
      bestStreak: 0,
      lastActiveDate: null,
      days: {}   // { [day]: { reading:{band,raw,completed,…}, writing:{…}, listening:{…} } }
    };
  }

  function getProgress() {
    const p = read(K.PROGRESS, null);
    return (p && p.days) ? p : freshProgress();
  }

  function saveProgress(p) { write(K.PROGRESS, p); }

  /* ---------- Settings ---------- */
  function getSettings() {
    return Object.assign(
      { theme: 'auto', model: CONFIG.AI.DEFAULT_MODEL, openrouterKey: '' },
      read(K.SETTINGS, {})
    );
  }
  function saveSettings(s) { write(K.SETTINGS, s); }
  function getSetting(key, fallback = null) {
    const v = getSettings()[key];
    return (v === undefined || v === null) ? fallback : v;
  }
  function setSetting(key, value) { const s = getSettings(); s[key] = value; saveSettings(s); }

  /* ---------- Day records ---------- */
  function dayRecord(day, create = false) {
    const p = getProgress();
    if (!p.days[day]) {
      if (!create) return null;
      p.days[day] = { reading: null, writing: null, listening: null };
      saveProgress(p);
    }
    return p.days[day];
  }

  function isSectionDone(day, section) {
    const rec = dayRecord(day);
    return !!(rec && rec[section] && rec[section].completed);
  }

  function allSectionsDone(day) {
    const rec = dayRecord(day);
    if (!rec) return false;
    return SECTIONS.every(s => rec[s] && rec[s].completed);
  }

  /* ---------- Streaks ---------- */
  function recordActivity() {
    const p = getProgress();
    const today = todayISO();
    if (p.lastActiveDate !== today) {
      if (p.lastActiveDate && daysBetween(p.lastActiveDate, today) === 1) p.streak += 1;
      else p.streak = 1;
      p.lastActiveDate = today;
      p.bestStreak = Math.max(p.bestStreak || 0, p.streak);
    }
    saveProgress(p);
    return p.streak;
  }

  function displayStreak(p = getProgress()) {
    if (!p.lastActiveDate) return 0;
    const diff = daysBetween(p.lastActiveDate, todayISO());
    return (diff === 0 || diff === 1) ? (p.streak || 0) : 0;
  }

  /* ---------- Complete a section (payload: { raw, band, durationSec, … }) ---------- */
  function completeSection(day, section, payload = {}) {
    const p = getProgress();
    if (!p.days[day]) p.days[day] = { reading: null, writing: null, listening: null };

    const prev = p.days[day][section] || {};
    p.days[day][section] = Object.assign({}, prev, payload, {
      completed: true,
      completedAt: new Date().toISOString()
    });

    /* Auto-advance the journey when the current day is fully done */
    const done = SECTIONS.every(s => p.days[day][s] && p.days[day][s].completed);
    if (day === p.currentDay && done && p.currentDay < CONFIG.TOTAL_DAYS) {
      p.currentDay = day + 1;
    }

    saveProgress(p);
    recordActivity();
    return p;
  }

  /* ---------- Exam drafts (crash / refresh safe) ---------- */
  function saveDraft(day, section, data) {
    const d = read(K.DRAFT, {});
    d[`${day}:${section}`] = Object.assign({}, data, { savedAt: Date.now() });
    write(K.DRAFT, d);
  }
  function getDraft(day, section) {
    const d = read(K.DRAFT, {});
    return d[`${day}:${section}`] || null;
  }
  function clearDraft(day, section) {
    const d = read(K.DRAFT, {});
    delete d[`${day}:${section}`];
    write(K.DRAFT, d);
  }

  /* ---------- Stats ---------- */
  function stats() {
    const p = getProgress();
    const dayKeys = Object.keys(p.days).map(Number);
    let sectionsDone = 0, bandSum = 0, bandCount = 0;
    const bySection = { reading: 0, writing: 0, listening: 0 };

    dayKeys.forEach(d => {
      SECTIONS.forEach(s => {
        const r = p.days[d] && p.days[d][s];
        if (r && r.completed) {
          sectionsDone++;
          bySection[s]++;
          if (typeof r.band === 'number') { bandSum += r.band; bandCount++; }
        }
      });
    });

    return {
      daysTouched: dayKeys.length,
      sectionsDone,
      bySection,
      avgBand: bandCount ? Math.round((bandSum / bandCount) * 10) / 10 : null,
      streak: displayStreak(p),
      bestStreak: p.bestStreak || 0,
      currentDay: p.currentDay,
      overallPercent: Math.round(((p.currentDay - 1) / CONFIG.TOTAL_DAYS) * 100)
    };
  }

  /* ---------- Data tools ---------- */
  function exportData() {
    return { app: CONFIG.APP_NAME, version: CONFIG.APP_VERSION, progress: getProgress(), settings: getSettings(), exportedAt: new Date().toISOString() };
  }

  function resetAll() {
    [K.PROGRESS, K.SETTINGS, K.DRAFT].forEach(k => localStorage.removeItem(k));
  }

  return {
    getProgress, saveProgress,
    getSettings, saveSettings, getSetting, setSetting,
    dayRecord, isSectionDone, allSectionsDone, completeSection,
    recordActivity, displayStreak,
    saveDraft, getDraft, clearDraft,
    stats, exportData, resetAll
  };
})();