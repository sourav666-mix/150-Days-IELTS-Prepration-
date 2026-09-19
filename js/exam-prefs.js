/* ============================================================
   IELTS PRO 150 — exam-prefs.js
   1) Global "section complete" event (Store.completeSection wrapper)
   2) Strict-audio enforcement: wraps the LAudio engine so each
      recording plays ONCE per Listening visit (restart blocked).
   3) Strict-pause body flag: CSS hides all exam pause buttons.
   Loads after storage.js + listening-data.js, before boot.js.
   ============================================================ */

'use strict';

(function () {

  /* ---------- 1 · section-complete event ---------- */
  const _origComplete = Store.completeSection;
  Store.completeSection = function (day, section, payload) {
    const p = _origComplete(day, section, payload);
    try {
      document.dispatchEvent(new CustomEvent('ielts:section-complete', { detail: { day, section } }));
    } catch (e) { /* very old browsers: mock bar simply won't react */ }
    return p;
  };

  /* ---------- 2 · strict audio (play-once per recording) ---------- */
  if (window.LAudio) {
    const _hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
    let currentRec = 0;
    const played = new Set();

    const _load = LAudio.load.bind(LAudio);
    LAudio.load = function (lines) {
      currentRec = _hash(String((lines && lines[0]) || ''));
      _load(lines);
    };

    const _play = LAudio.play.bind(LAudio);
    LAudio.play = function () {
      if (Store.getSetting('strictAudio', false)) {
        const st = LAudio.status();
        /* blocked only when RESTARTING a finished/unstarted recording;
           pause → resume still works */
        if (played.has(currentRec) && (st.state === 'idle' || st.state === 'done')) {
          toast('Strict audio mode: each recording plays once only.', 'warn', 3000);
          return;
        }
      }
      played.add(currentRec);
      return _play();
    };

    /* one play per visit: reset the ledger when Listening is entered */
    window.addEventListener('hashchange', () => {
      if ((location.hash || '').indexOf('listening') !== -1) played.clear();
    });
  }

  /* ---------- 3 · strict pause flag ---------- */
  function apply() {
    const s = Store.getSettings();
    if (s.strictPause) document.body.setAttribute('data-strict-pause', '1');
    else document.body.removeAttribute('data-strict-pause');
  }

  window.ExamPrefs = { apply };
  document.addEventListener('DOMContentLoaded', apply);

})();