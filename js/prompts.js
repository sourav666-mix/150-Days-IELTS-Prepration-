/* ============================================================
   IELTS PRO 150 — Prompt Library ("Examiner Ada")
   Every prompt returns { system, prompt } and demands STRICT
   JSON so the UI can render scores, corrections & answer keys.
   ============================================================ */

'use strict';

const Prompts = (() => {

  const JSON_RULE = 'Respond with ONLY one valid JSON object. No markdown, no code fences, no text before or after the JSON.';

  /* ---------- Examiner persona ---------- */
  function system() {
    return [
      'You are "Examiner Ada" — a senior certified IELTS examiner with 15+ years of experience marking Cambridge IELTS Academic papers (Reading, Writing, Listening).',
      'You know the official band descriptors and the raw-score → band conversion tables precisely.',
      'Rules:',
      '1. Be rigorous but encouraging; identify the exact weaknesses that block Band 8.',
      '2. Never invent content the student did not write — quote their exact sentences when correcting.',
      '3. When asked for JSON, output ONLY one valid JSON object with no markdown fences and no commentary.',
      '4. Keep explanations concise as instructed per field.',
      '5. Use standard IELTS terminology: "overview", "cohesion", "lexical resource", "complex structures", "band descriptor".'
    ].join('\n');
  }

  /* ---------- Shared writing schema ---------- */
  function _writingSchema(taskLabel, sampleWords) {
    return `{
  "overallBand": 6.5,
  "criteria": {
    "task":      {"band": 6.0, "label": "${taskLabel}", "comment": "max 45 words"},
    "coherence": {"band": 6.0, "label": "Coherence & Cohesion", "comment": "max 45 words"},
    "lexical":   {"band": 6.0, "label": "Lexical Resource", "comment": "max 45 words"},
    "grammar":   {"band": 6.0, "label": "Grammatical Range & Accuracy", "comment": "max 45 words"}
  },
  "strengths": ["3-5 short bullets"],
  "issues": [{"original": "exact quoted sentence from the essay", "corrected": "corrected version", "type": "grammar|vocabulary|cohesion|task", "explanation": "max 25 words"}],
  "upgradedSentences": [{"original": "...", "band8": "..."}],
  "sampleAnswer": "complete model answer of about ${sampleWords} words for THIS exact prompt",
  "wordCountFeedback": "one sentence comparing with the minimum word count",
  "priorityFixes": ["3 concrete actions for the next essay"]
}`;
  }

  /* ============================================================
     WRITING TASK 1 — chart/graph/table/diagram report
     ============================================================ */
  function writingTask1({ chartType, chartTitle, chartData, essay, wordCount }) {
    return {
      system: system(),
      prompt:
`Assess this IELTS Academic Writing Task 1 response EXACTLY against the official band descriptors.

TASK: Describe a ${chartType} — "${chartTitle}". Minimum 150 words. Suggested time: 20 minutes.

VISUAL DATA (JSON):
 ${JSON.stringify(chartData)}

STUDENT ESSAY (${wordCount} words):
"""
 ${String(essay).slice(0, 6000)}
"""

Assessment rules:
- Task Achievement: Is there a clear overview? Are key features selected, grouped and COMPARED rather than listed mechanically? Data must be accurate.
- Coherence & Cohesion: logical paragraphing, referencing, linking. Over-use of mechanical connectors ("Firstly, Secondly, In conclusion") caps Band 8.
- Lexical Resource: range, precision, collocation accuracy; notice repetition.
- Grammatical Range & Accuracy: variety of complex structures AND control. Quote the student's exact words in "issues".
- overallBand = average of the four criteria, rounded to the nearest half band.
- issues: 4-8 of the most instructive problems, quoted exactly.
- upgradedSentences: 3 rewrites of weaker sentences at Band 8 level.
- sampleAnswer: 160-190 words, Band 8-9, for THIS data.
- If the essay is under 150 words, still mark it fully and reflect the penalty in wordCountFeedback.

 ${JSON_RULE}
JSON schema:
 ${_writingSchema('Task Achievement', 175)}`
    };
  }

  /* ============================================================
     WRITING TASK 2 — academic essay
     ============================================================ */
  function writingTask2({ prompt, essayType, theme, essay, wordCount }) {
    return {
      system: system(),
      prompt:
`Assess this IELTS Academic Writing Task 2 essay EXACTLY against the official band descriptors.

ESSAY TYPE: ${essayType} (${theme})
QUESTION: ${prompt}
Minimum 250 words. Suggested time: 40 minutes.

STUDENT ESSAY (${wordCount} words):
"""
 ${String(essay).slice(0, 7000)}
"""

Assessment rules:
- Task Response: Is the position clear throughout and directly responsive? Are ideas developed with relevant, specific support (not generic lists)?
- Coherence & Cohesion: logical paragraphing (typically 4 paragraphs), clear progression, referencing over mechanical linkers.
- Lexical Resource: range, precision, collocation, awareness of style/tone.
- Grammatical Range & Accuracy: complex structures with control; quote exact errors in "issues".
- overallBand = average of the four criteria, rounded to the nearest half band.
- issues: 5-10 of the most instructive problems, quoted exactly.
- upgradedSentences: 3-4 rewrites at Band 8 level.
- sampleAnswer: 270-320 words, Band 8-9, answering THIS question with a clear position.

 ${JSON_RULE}
JSON schema:
 ${_writingSchema('Task Response', 290)}`
    };
  }

  /* ============================================================
     READING — full 40-question marking + deep analysis
     ============================================================ */
  function readingMarking({ titles = [], questions = [], passagesText = null, minutesUsed = null }) {
    const q = questions.map(x => ({
      n: x.n, type: x.type, prompt: x.prompt,
      userAnswer: x.userAnswer == null ? '' : String(x.userAnswer).slice(0, 200),
      ...(x.correctAnswer != null ? { correctAnswer: x.correctAnswer } : {})
    }));
    const keyProvided = questions.some(x => x.correctAnswer != null);

    return {
      system: system(),
      prompt:
`Mark this complete IELTS Academic Reading test (40 questions) like an official examiner.

PASSAGES:
 ${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

 ${keyProvided
  ? 'The OFFICIAL ANSWER KEY is embedded in each question below — treat it as ground truth.'
  : 'No answer key is provided — derive the correct answers from the passage text below.'}
Official raw-score → band scale (minimum raw → band): ${JSON.stringify(CONFIG.READING_BAND_SCALE)}

QUESTIONS + STUDENT ANSWERS (JSON):
 ${JSON.stringify(q)}

 ${minutesUsed != null ? `Time used: ${minutesUsed} of 60 minutes.` : ''}

 ${passagesText ? `PASSAGE TEXT (ground truth):\n${String(passagesText).slice(0, 14000)}` : ''}

Marking rules:
- Official tolerance: exact spelling required; US/UK spelling both accepted; ignore capitalisation; where the key shows "(the)", the article is optional.
- "verdict": "correct", "incorrect" or "unanswered".
- "explanation": max 25 words; state WHERE the answer comes from, e.g. "Paragraph C: '...' — paraphrase of the question."
- "summary": 2 sentences on overall performance vs Band 8.
- "strategyTips": 4 tips targeting the question types missed most.
- "vocabularyFocus": 5 items as "word — short meaning" taken from the passages.
- "nextSteps": 3 concrete actions for tomorrow.
- "band" MUST follow the raw→band scale exactly (half bands like 7.5).

 ${JSON_RULE}
JSON schema:
{"band": 0.0, "raw": 0, "correct": 0, "incorrect": 0, "unanswered": 0, "summary": "...",
 "review": [{"q": 1, "verdict": "correct|incorrect|unanswered", "yourAnswer": "...", "correctAnswer": "...", "explanation": "..."}],
 "strengths": ["..."], "weaknesses": ["..."], "strategyTips": ["..."], "vocabularyFocus": ["..."], "nextSteps": ["..."]}`
    };
  }

  /* ============================================================
     LISTENING — full 40-question marking + deep analysis
     ============================================================ */
  function listeningMarking({ sectionTitles = [], transcript, questions = [], minutesUsed = null }) {
    const q = questions.map(x => ({
      n: x.n, section: x.section, type: x.type, prompt: x.prompt,
      userAnswer: x.userAnswer == null ? '' : String(x.userAnswer).slice(0, 200),
      ...(x.correctAnswer != null ? { correctAnswer: x.correctAnswer } : {})
    }));
    const keyProvided = questions.some(x => x.correctAnswer != null);

    return {
      system: system(),
      prompt:
`Mark this complete IELTS Listening test (40 questions, 4 sections) like an official examiner.

SECTIONS:
 ${sectionTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

 ${keyProvided
  ? 'The OFFICIAL ANSWER KEY is embedded in each question below — treat it as ground truth, using the transcript to write explanations.'
  : 'Use the FULL TRANSCRIPT below as ground truth for every answer.'}
Official raw-score → band scale (minimum raw → band): ${JSON.stringify(CONFIG.LISTENING_BAND_SCALE)}

QUESTIONS + STUDENT ANSWERS (JSON):
 ${JSON.stringify(q)}

Time used: ${minutesUsed != null ? minutesUsed + ' of 30 minutes' : 'unknown'}.

TRANSCRIPT (ground truth):
 ${String(transcript || '').slice(0, 16000)}

Marking rules:
- Answers must be correctly spelled (US/UK both fine); plurals must match the recording; hyphenation and one-word/two-word forms follow the transcript; numbers in figures or words both accepted.
- "verdict": "correct", "incorrect" or "unanswered".
- "explanation": max 25 words, citing the speaker, e.g. "Section 2, guide: '...' — the answer word is 'ferry'."
- "summary": 2 sentences vs Band 8, note which sections were weakest.
- "strategyTips": 4 tips (prediction, keyword underlining, signpost words, spelling discipline).
- "vocabularyFocus": 5 items "word/phrase — meaning" heard in the recording.
- "nextSteps": 3 actions.
- "band" MUST follow the raw→band scale exactly.

 ${JSON_RULE}
JSON schema:
{"band": 0.0, "raw": 0, "correct": 0, "incorrect": 0, "unanswered": 0, "summary": "...",
 "review": [{"q": 1, "verdict": "correct|incorrect|unanswered", "yourAnswer": "...", "correctAnswer": "...", "explanation": "..."}],
 "strengths": ["..."], "weaknesses": ["..."], "strategyTips": ["..."], "vocabularyFocus": ["..."], "nextSteps": ["..."]}`
    };
  }

  /* ============================================================
     AI COACH — daily personalised guidance
     ============================================================ */
  function coach(ctx) {
    return {
      system: system(),
      prompt:
`You are the student's personal IELTS coach. Based on their LIVE statistics below, produce today's coaching message.

STUDENT DATA (JSON):
 ${JSON.stringify(ctx, null, 2)}

Requirements:
- "focus": the single highest-leverage thing to work on today (max 22 words).
- "why": one sentence explaining why, referencing their actual numbers.
- "tip": one practical, specific technique (max 40 words).
- "drills": exactly 3 short practice drills for today (each max 14 words).
- "motivation": one encouraging sentence (max 20 words).

 ${JSON_RULE}
JSON schema:
{"focus": "...", "why": "...", "tip": "...", "drills": ["...", "...", "..."], "motivation": "..."}`
    };
  }

  return { system, JSON_RULE, writingTask1, writingTask2, readingMarking, listeningMarking, coach };
})();