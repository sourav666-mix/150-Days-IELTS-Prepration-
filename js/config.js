/* ============================================================
   IELTS PRO 150 — Global Configuration
   ============================================================ */

const CONFIG = {
  APP_NAME: 'IELTS Pro 150',
  APP_VERSION: '1.0.0',
  TARGET_BAND: 8,
  TOTAL_DAYS: 150,
  STORAGE_PREFIX: 'ielts150_',

  /* ---------- Exam timings (seconds) ---------- */
  READING_DURATION:   60 * 60,   // 3 passages · 40 questions
  WRITING_DURATION:   60 * 60,   // Task 1 (20m suggested) + Task 2 (40m suggested)
  LISTENING_DURATION: 30 * 60,   // 4 sections · 40 questions

  /* ---------- Reading blueprint (official Academic format) ---------- */
  READING: {
    PASSAGES: 3,
    QUESTIONS: 40,
    MIN_TOTAL_WORDS: 2150,
    MAX_TOTAL_WORDS: 2750,
    CHECKPOINTS: [10 * 60, 5 * 60, 60]   // warnings at 10 / 5 / 1 minutes left
  },

  /* ---------- Writing blueprint ---------- */
  WRITING: {
    TASK1_MIN_WORDS: 150,
    TASK2_MIN_WORDS: 250,
    TASK1_SUGGESTED_MINUTES: 20,
    TASK2_SUGGESTED_MINUTES: 40,
    CRITERIA: [
      'Task Achievement / Response',
      'Coherence & Cohesion',
      'Lexical Resource',
      'Grammatical Range & Accuracy'
    ],
    CHECKPOINTS: [40 * 60, 20 * 60]      // suggested Task-2 start / final check
  },

  /* ---------- Listening blueprint ---------- */
  LISTENING: {
    QUESTIONS: 40,
    SECTIONS: 4,
    CHECKPOINTS: [22 * 60, 15 * 60, 7 * 60],
    SECTION_META: [
      { num: 1, context: 'Social · Conversation',  desc: 'Two speakers in an everyday situation (booking, enquiry, registration).' },
      { num: 2, context: 'Social · Monologue',     desc: 'One speaker on an everyday topic (tour, announcement, induction).' },
      { num: 3, context: 'Academic · Discussion',  desc: 'Up to four speakers in a study / training context.' },
      { num: 4, context: 'Academic · Lecture',     desc: 'One speaker on an academic subject.' }
    ]
  },

  /* ---------- Official raw-score → band conversion ---------- */
  READING_BAND_SCALE: {
    39: 9.0, 37: 8.0, 35: 7.5, 33: 7.0, 30: 6.5, 27: 6.0, 23: 5.5,
    19: 5.0, 15: 4.5, 13: 4.0, 10: 3.5, 8: 3.0, 6: 2.5, 4: 2.0, 0: 1.0
  },
  LISTENING_BAND_SCALE: {
    39: 9.0, 37: 8.0, 35: 7.5, 32: 7.0, 30: 6.5, 27: 6.0, 23: 5.5,
    18: 5.0, 16: 4.5, 13: 4.0, 10: 3.5, 8: 3.0, 6: 2.5, 4: 2.0, 0: 1.0
  },

  /* ---------- AI (OpenRouter) ---------- */
  AI: {
    PROXY_URL: '/api/openrouter',
    DEFAULT_MODEL: 'openai/gpt-4o-mini',
    MODELS: [
      /* — established models — */
      { id: 'openai/gpt-4o-mini',            label: 'GPT-4o mini — fast & economical (recommended)' },
      { id: 'openai/gpt-4o',                 label: 'GPT-4o — high quality' },
      { id: 'anthropic/claude-3.5-sonnet',   label: 'Claude 3.5 Sonnet — best writing feedback' },
      { id: 'google/gemini-flash-1.5',       label: 'Gemini Flash 1.5 — very fast' },
      { id: 'deepseek/deepseek-chat',        label: 'DeepSeek V3 — budget option' },
      /* — new generation flash models — */
      { id: 'deepseek/deepseek-v4.1-flash',  label: 'DeepSeek V4.1 Flash — fast & economical' },
      { id: 'google/gemini-3.8-flash',       label: 'Gemini 3.8 Flash — very fast' },
      { id: 'qwen/qwen3.8-flash',            label: 'Qwen 3.8 Flash — fast multilingual' },
      { id: 'z-ai/glm-5.3-flash',            label: 'GLM 5.3 Flash — strong writing feedback' }
    ],
    TEMPERATURE: 0.35,
    MAX_TOKENS: 3000,
    TIMEOUT_MS: 90000
  }
};