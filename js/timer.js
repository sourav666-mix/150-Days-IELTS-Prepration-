/* ============================================================
   IELTS PRO 150 — ExamTimer
   Drift-free countdown · pause/resume · checkpoints · auto-expire
   Used by Reading (60m), Writing (60m) and Listening (30m).
   ============================================================ */

'use strict';

class ExamTimer {
  /**
   * @param {Object} opts
   * @param {number}   opts.duration      total seconds
   * @param {HTMLElement} [opts.displayEl] element for mm:ss text
   * @param {HTMLElement} [opts.barEl]    progress bar fill
   * @param {HTMLElement} [opts.wrapEl]   wrapper — gets timer-warn / timer-critical classes
   * @param {number[]} [opts.checkpoints] seconds-remaining warnings
   * @param {Function} [opts.onTick]      (remainingSeconds) each 250ms
   * @param {Function} [opts.onWarning]   (checkpointSeconds) once per checkpoint
   * @param {Function} [opts.onExpire]    fires once at 0 — module should auto-submit
   */
  constructor({ duration, displayEl = null, barEl = null, wrapEl = null,
                checkpoints = [600, 300, 60], onTick = null, onWarning = null, onExpire = null }) {
    this.total = duration;
    this.remaining = duration;
    this.displayEl = displayEl;
    this.barEl = barEl;
    this.wrapEl = wrapEl;
    this.checkpoints = checkpoints;
    this.onTick = onTick;
    this.onWarning = onWarning;
    this.onExpire = onExpire;

    this.running = false;
    this.expired = false;
    this.fired = new Set();
    this._int = null;
    this._last = 0;

    this._render();
  }

  start() {
    if (this.running || this.expired) return this;
    this.running = true;
    this._last = Date.now();
    this._int = setInterval(() => this._tick(), 250);
    this._render();
    return this;
  }

  pause() {
    this.running = false;
    if (this._int) { clearInterval(this._int); this._int = null; }
    this._render();
    return this;
  }

  get paused() { return !this.running && !this.expired; }

  resume() { return this.start(); }
  stop()   { return this.pause(); }

  /** Add bonus seconds (e.g. reading "re-practice" mode). */
  add(seconds) {
    this.total += seconds;
    this.remaining += seconds;
    this.expired = false;
    this.fired.clear();
    this._render();
    return this;
  }

  _tick() {
    const now = Date.now();
    this.remaining = Math.max(0, this.remaining - (now - this._last) / 1000);
    this._last = now;

    for (const c of this.checkpoints) {
      if (!this.fired.has(c) && this.remaining <= c && this.remaining > 0) {
        this.fired.add(c);
        if (this.onWarning) this.onWarning(c);
      }
    }

    if (this.remaining <= 0 && !this.expired) {
      this.expired = true;
      this._render();
      this.pause();
      if (this.onExpire) this.onExpire();
      return;
    }

    this._render();
    if (this.onTick) this.onTick(this.remaining);
  }

  _render() {
    if (this.displayEl) this.displayEl.textContent = fmtTime(this.remaining);

    if (this.barEl) {
      const pct = this.total ? ((this.total - this.remaining) / this.total) * 100 : 0;
      this.barEl.style.width = pct.toFixed(2) + '%';
    }

    if (this.wrapEl) {
      this.wrapEl.classList.toggle('timer-warn',     this.remaining <= 600 && this.remaining > 300);
      this.wrapEl.classList.toggle('timer-critical', this.remaining <= 300);
      this.wrapEl.classList.toggle('timer-paused',   this.paused && this.remaining > 0 && this.remaining < this.total);
    }
  }
}