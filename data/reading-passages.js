/* ============================================================
   IELTS PRO 150 — Reading Bank  (v4 — self-healing generator)
   1) ReadingBank.builtin() — complete offline test: 3 passages
      (~2,250 words), 40 questions, verified answer key.
   2) ReadingBank.gen() — AI generator, v4 strategy:
        • per-part counts are SOFT — any structurally valid part
          is accepted
        • SANITIZE: every part is repaired before assembly —
          type aliases normalized, group pools repaired/borrowed/
          synthesized, MCQ options & answers validated, broken
          questions dropped (top-up replaces them)
        • ASSEMBLY: exact total enforced — surplus safely
          trimmed; shortage filled with AI tfng top-ups
        • a part that yields 0 valid questions keeps its passage
          and is filled by top-up — generation never dead-ends
   3) buildTest renumbers 1–40 · validateTest is the final net.
   ============================================================ */

'use strict';

const ReadingBank = (() => {

  /* ==========================================================
     PART 1 — The Story of Silk (Q1–13)
     ========================================================== */
  const P1 = {
    title: 'The Story of Silk',
    paragraphs: [
      { letter: 'A', text: `Silk has been prized for so long that it is woven into legend. The most famous Chinese story tells how Empress Leizu, drinking tea beneath a mulberry tree, watched a cocoon drop into her cup and discovered that its single fine thread could be unwound and spun. Legend, however, should not be confused with evidence: what historians can establish with certainty is that sericulture — the farming of silkworms for their fibre — began in China, where archaeologists have uncovered silk fragments and jade silkworm carvings several thousand years old. Silk was by no means humanity's first fabric; linen and wool predate it by millennia, and cotton weaving arose independently elsewhere. Yet no earlier cloth matched its strength, warmth and sheen, and demand for it would go on to shape trade, technology and diplomacy across the ancient world.` },
      { letter: 'B', text: `For close to three thousand years China guarded a total monopoly on the fabric. The imperial court made it a capital crime to export silkworm eggs or mulberry seeds, and guards watched the frontier passes for smugglers. The monopoly brought astonishing wealth: silk was light, compact and universally desired, so a bale carried over the mountains could be sold for many times its weight in goods. Foreign courts from Korea to Persia coveted the shimmering cloth without the faintest idea how it was made, and the mystery itself became part of its value.` },
      { letter: 'C', text: `That value opened the greatest trade corridor of the ancient world. By the second century BC, camel caravans were hauling bolts of silk westward along the network of routes we now call the Silk Road, linking Chang'an to the markets of Persia and, eventually, imperial Rome. In Rome the fabric caused a sensation: it was literally worth its weight in gold, and at times it even served as currency when coins grew scarce. The camels, meanwhile, became the undisputed pack animal of the desert roads, carrying silk, spices and ideas — including religions and technologies — in both directions.` },
      { letter: 'D', text: `The Chinese monopoly could not last forever. Around 550 AD, according to the Byzantine historian Procopius, two monks smuggled silkworm eggs out of China inside hollow walking canes and delivered them to the emperor at Constantinople, where the worms were hatched and fed on mulberry leaves. Sericulture spread gradually through the Mediterranean and later to other regions, though one nation in particular industrialised it with spectacular success: by the early twentieth century Japan had overtaken China as the world's largest producer, building vast mechanised filatures that supplied mills across Europe and America.` },
      { letter: 'E', text: `The twentieth century brought competition from an unexpected quarter — chemistry. In 1935 researchers at the American company DuPont produced nylon, the first synthetic fibre strong and lustrous enough to be marketed as an imitation silk, and sales of natural silk slumped during the decades that followed. Yet reports of silk's death were exaggerated. Haute couture continues to prize the natural fibre, surgeons still sew with silk sutures, and sericulture today supports the livelihoods of millions of smallholder farmers across Asia. Far from extinct, the ancient craft has proved remarkably durable.` }
    ],
    questions: [
      { type: 'tfng', prompt: 'Sericulture began in China.', answer: 'TRUE' },
      { type: 'tfng', prompt: 'Historical records prove that Empress Leizu invented sericulture.', answer: 'NOT GIVEN' },
      { type: 'tfng', prompt: 'Exporting silkworm eggs from imperial China was punishable by death.', answer: 'TRUE' },
      { type: 'tfng', prompt: 'Byzantine monks are said to have smuggled silkworm eggs inside hollow canes.', answer: 'TRUE' },
      { type: 'tfng', prompt: 'Silk was the first fabric used by humans.', answer: 'FALSE' },
      { type: 'tfng', prompt: 'Synthetic fibres have completely replaced natural silk.', answer: 'FALSE' },
      { type: 'fill', group: {
          title: 'Complete the summary below. Choose ONE WORD ONLY from the passage.',
          allow: 'ONE WORD ONLY',
          text: `Long before aircraft, silk travelled the overland network we now call the Silk Road. In Rome the fabric was at times used as a form of (7) ______. Crossing the deserts, the caravans depended on (8) ______. Around 550 AD, two Byzantine (9) ______ carried eggs to Constantinople, and by the early twentieth century (10) ______ had become the world's leading silk producer.`
        },
        prompt: 'Summary blank 7', answer: 'currency' },
      { type: 'fill', group: 'S1', prompt: 'Summary blank 8', answer: 'camels' },
      { type: 'fill', group: 'S1', prompt: 'Summary blank 9', answer: 'monks' },
      { type: 'fill', group: 'S1', prompt: 'Summary blank 10', answer: 'Japan' },
      { type: 'short', group: {
          title: 'Answer the questions below. Use NO MORE THAN THREE WORDS from the passage.',
          allow: 'NO MORE THAN THREE WORDS'
        },
        prompt: 'According to legend, who discovered that a cocoon\u2019s thread could be unwound?', answer: ['Empress Leizu', 'Leizu', 'the Empress Leizu'] },
      { type: 'short', group: 'S2', prompt: 'Which country was the world\u2019s largest silk producer by the early twentieth century?', answer: 'Japan' },
      { type: 'short', group: 'S2', prompt: 'Which synthetic fibre, invented in 1935, was first marketed as an imitation silk?', answer: 'nylon' }
    ]
  };

  /* ==========================================================
     PART 2 — Printing the Human Body (Q14–26)
     ========================================================== */
  const P2 = {
    title: 'Printing the Human Body',
    paragraphs: [
      { letter: 'A', text: `Three-dimensional printing began in the 1980s as a workshop tool for engineers, who used it to build quick plastic prototypes of parts. Its first medical applications were equally down-to-earth: technicians printed custom sockets so that artificial limbs fitted comfortably, dental aligners moulded to an individual patient's bite, and lightweight guides that helped surgeons place implants with millimetre precision. Little by little, however, bioengineers asked a bolder question. If a printer could lay down plastic layer upon layer, could it lay down living cells in the same way? That question turned a workshop technology into one of the most ambitious projects in modern medicine: the printing of human tissue — and, one day, entire organs — directly from a patient's own cells.` },
      { letter: 'B', text: `The principle is disarmingly simple. A bioprinter deposits "bioink" — living cells suspended in a nourishing gel — through a fine nozzle, following a digital blueprint derived from medical scans. It builds the tissue layer by layer, and temporary printed structures called scaffolds hold everything in shape while the cells mature; these scaffolds later dissolve harmlessly in the body. Chemical messengers known as growth factors are added at precise moments to persuade unspecialised cells to become bone, cartilage, skin or muscle. Every element of the process — the ink, the geometry, the timing — is tuned to coax cells into behaving as they would inside the body.` },
      { letter: 'C', text: `Beneath the promise, however, lies a stubborn obstacle: every cell must be fed. In living tissue, a dense network of blood vessels delivers oxygen and nutrients to within a fraction of a millimetre of each cell. Printed tissue thicker than a few millimetres simply starves — the outer layers survive while the core dies within hours. Solving this "vascularisation problem" is now the field's central challenge. Some laboratories bioprint capillary channels that hook up to the recipient's circulation; others pre-vascularise tissue before transplanting it. Until the problem is fully solved, printing a complex organ such as a kidney or a heart remains out of reach.` },
      { letter: 'D', text: `Alongside the technical challenges sit regulatory and ethical ones, and the rulebook is still being written. In a landmark early trial, surgeons gave seven young patients new bladders grown from the patients' own cells — the first engineered organ transplants of their kind — and the results reshaped what regulators believed possible. Agencies in Europe and the United States are now defining how printed tissue must be tested, how donors of cells must consent, and who pays when a bespoke implant fails. The technology is advancing faster than the framework that governs it, a familiar dilemma for any young science.` },
      { letter: 'E', text: `The prize is personalised organs on demand. More than a hundred thousand people sit on transplant waiting lists in the United States alone, and many die before a matching organ appears. A printed organ grown from the patient's own cells would end a lifetime of anti-rejection drugs and, in principle, be produced to order. Researchers even imagine printing skin directly onto severe burns at the bedside. Such scenarios remain distant, but they are no longer fantastical — and each year the printed tissues grow larger, thicker and more alive.` }
    ],
    questions: [
      { type: 'mcq', prompt: 'According to the passage, the earliest medical uses of 3D printing included producing',
        options: [
          { label: 'A', text: 'printed organs for transplant' },
          { label: 'B', text: 'custom fittings for artificial limbs' },
          { label: 'C', text: 'printed skin for burn victims' },
          { label: 'D', text: 'engineered bladders for children' }
        ], answer: 'B' },
      { type: 'mcq', prompt: 'What is described as the greatest obstacle to printing large organs?',
        options: [
          { label: 'A', text: 'the high price of bioprinters' },
          { label: 'B', text: 'supplying oxygen and nutrients throughout the tissue' },
          { label: 'C', text: 'finding enough suitable cells' },
          { label: 'D', text: 'opposition from the public' }
        ], answer: 'B' },
      { type: 'mcq', prompt: 'In the landmark bladder trial, the cells used to grow the new organs came from',
        options: [
          { label: 'A', text: 'unrelated donors' },
          { label: 'B', text: 'animal tissue' },
          { label: 'C', text: 'the patients themselves' },
          { label: 'D', text: 'synthetic polymer scaffolds' }
        ], answer: 'C' },
      { type: 'heading', group: {
          title: 'Reading Passage 2 has five paragraphs, A\u2013E. Choose the correct heading for each paragraph from the list below.',
          pool: [
            { label: 'i',   text: 'How a bioprinter builds tissue' },
            { label: 'ii',  text: 'The problem of keeping tissue alive' },
            { label: 'iii', text: 'Custom parts for every patient' },
            { label: 'iv',  text: 'Organs made to order' },
            { label: 'v',   text: 'Regulating a young technology' },
            { label: 'vi',  text: 'A rejected first attempt' },
            { label: 'vii', text: 'Cheaper printers, wider access' },
            { label: 'viii',text: 'From plastic parts to printed cells' }
          ]
        },
        prompt: 'Paragraph A', answer: 'viii' },
      { type: 'heading', group: 'H2', prompt: 'Paragraph B', answer: 'i' },
      { type: 'heading', group: 'H2', prompt: 'Paragraph C', answer: 'ii' },
      { type: 'heading', group: 'H2', prompt: 'Paragraph D', answer: 'v' },
      { type: 'heading', group: 'H2', prompt: 'Paragraph E', answer: 'iv' },
      { type: 'fill', group: {
          title: 'Complete the sentences below. Use NO MORE THAN TWO WORDS from the passage.',
          allow: 'NO MORE THAN TWO WORDS'
        },
        prompt: 'Living cells are mixed with a nourishing gel known as 22 ______.', answer: 'bioink' },
      { type: 'fill', group: 'F2', prompt: 'Thick printed tissue quickly dies without its own 23 ______.', answer: ['blood vessels', 'blood vessel network', 'capillaries'] },
      { type: 'fill', group: 'F2', prompt: 'Cells are guided to specialise correctly by chemical 24 ______.', answer: 'growth factors' },
      { type: 'fill', group: 'F2', prompt: 'Temporary printed structures that later dissolve are called 25 ______.', answer: 'scaffolds' },
      { type: 'fill', group: 'F2', prompt: 'In the landmark trial, the cells used came from the 26 ______ themselves.', answer: ['patients', 'patient'] }
    ]
  };

  /* ==========================================================
     PART 3 — The Hunt for Alien Worlds (Q27–40)
     ========================================================== */
  const P3 = {
    title: 'The Hunt for Alien Worlds',
    paragraphs: [
      { letter: 'A', text: `Until the final decade of the twentieth century, the only planets anyone had ever seen were the eight of our own solar system. Everything changed in 1995, when two Swiss astronomers, Michel Mayor and Didier Queloz, announced the first planet detected orbiting a star similar to our Sun — a body circling the star 51 Pegasi. Their discovery opened a new branch of astronomy almost overnight, and in 2019 the pair received the Nobel Prize in Physics, the field's highest recognition and a measure of how thoroughly exoplanet research has transformed our picture of the cosmos.` },
      { letter: 'B', text: `The most prolific detection method exploits simple geometry. If a planet's orbit happens to carry it across the face of its star as seen from Earth, the star's light dims by a tiny but regular amount at each crossing. Astronomers call this the transit method, and it turns a telescope into a cosmic light-meter. NASA's Kepler space telescope, launched in 2009, monitored some 150,000 stars continuously for years using exactly this trick, and the dips it recorded revealed thousands of planets — most of them far too faint and distant for any direct photograph.` },
      { letter: 'C', text: `A star, meanwhile, keeps its own record. Planets do not strictly orbit their stars; rather, each pair circles a shared centre of gravity, so a giant planet tugs its star into a small, repeating wobble. By splitting starlight into its spectrum and measuring the shift of dark lines, astronomers can detect the wobble and deduce the unseen planet's mass and orbital period. It is mathematics at its most powerful: a world no telescope can see directly betrays itself through the motion of its star.` },
      { letter: 'D', text: `The early results stunned the theorists. 51 Pegasi b turned out to be a gas giant roughly half the mass of Jupiter, yet it skims so close to its star that it completes an orbit every four days — a "hot Jupiter" huddled far nearer than Mercury is to the Sun. Nothing in the standard theory of planet formation predicted such objects, and their discovery forced researchers to rewrite the models: giant planets apparently form in cooler outer regions and then migrate inward. The lesson was humbling. Nature, it seemed, was more inventive than anyone had imagined.` },
      { letter: 'E', text: `A new generation of instruments is now trained on alien skies in a different way — on their atmospheres. The James Webb Space Telescope analyses starlight filtered through the air of transiting worlds, hunting chemical fingerprints such as oxygen and methane, gases that on Earth are produced overwhelmingly by living things. Enormous ground-based telescopes under construction will do the same for a wider range of planets. Nobody knows whether such biosignatures will ever be found, but for the first time in history the instruments exist that could find them.` },
      { letter: 'F', text: `More than five thousand exoplanets have now been confirmed, and the statistics imply that our galaxy alone contains billions of planets, many of them rocky worlds in temperate orbits. Each discovery has enlarged and humbled us in equal measure. Whatever the search eventually reveals about life elsewhere, it has already achieved something remarkable: it has changed humanity's sense of its place in the universe.` }
    ],
    questions: [
      { type: 'info', group: {
          title: 'Which paragraph contains the following information? Choose from A\u2013F.',
          pool: ['A', 'B', 'C', 'D', 'E', 'F']
        },
        prompt: 'a description of a technique that detects regular dips in a star\u2019s brightness', answer: 'B' },
      { type: 'info', group: 'I3', prompt: 'a discovery that contradicted the existing theory of how planets form', answer: 'D' },
      { type: 'info', group: 'I3', prompt: 'the use of a star\u2019s motion to reveal an invisible companion', answer: 'C' },
      { type: 'info', group: 'I3', prompt: 'an instance of a scientific field receiving its highest formal recognition', answer: 'A' },
      { type: 'mcq', prompt: 'The first planet found orbiting a Sun-like star was detected in',
        options: [
          { label: 'A', text: '1980' },
          { label: 'B', text: '1995' },
          { label: 'C', text: '2009' },
          { label: 'D', text: '2019' }
        ], answer: 'B' },
      { type: 'mcq', prompt: 'The transit method works by',
        options: [
          { label: 'A', text: 'detecting regular dips in a star\u2019s brightness' },
          { label: 'B', text: 'measuring a star\u2019s sideways wobble' },
          { label: 'C', text: 'taking direct photographs of planets' },
          { label: 'D', text: 'analysing radio signals from space' }
        ], answer: 'A' },
      { type: 'mcq', prompt: 'Hot Jupiters surprised astronomers because they',
        options: [
          { label: 'A', text: 'were frozen and lifeless' },
          { label: 'B', text: 'possessed large moons' },
          { label: 'C', text: 'orbited extremely close to their stars' },
          { label: 'D', text: 'were made mostly of ice' }
        ], answer: 'C' },
      { type: 'mcq', prompt: 'Which gases are named as possible biosignatures?',
        options: [
          { label: 'A', text: 'oxygen and methane' },
          { label: 'B', text: 'hydrogen and helium' },
          { label: 'C', text: 'nitrogen and argon' },
          { label: 'D', text: 'carbon monoxide only' }
        ], answer: 'A' },
      { type: 'ynng', prompt: 'The writer believes the search for exoplanets has altered humanity\u2019s view of its place in the universe.', answer: 'YES' },
      { type: 'ynng', prompt: 'Kepler was the first telescope to detect an exoplanet.', answer: 'NO' },
      { type: 'ynng', prompt: 'More than half of all confirmed exoplanets are rocky.', answer: 'NOT GIVEN' },
      { type: 'ynng', prompt: 'The writer thinks life will be discovered on an exoplanet within decades.', answer: 'NOT GIVEN' },
      { type: 'ending', group: {
          title: 'Complete each sentence with the correct ending, A\u2013E.',
          pool: [
            { label: 'A', text: 'planets that wander without a star.' },
            { label: 'B', text: 'instruments capable of analysing alien atmospheres.' },
            { label: 'C', text: 'billions of planets in our galaxy alone.' },
            { label: 'D', text: 'a faster orbit around the Sun.' },
            { label: 'E', text: 'the first photographs of distant worlds.' }
          ]
        },
        prompt: 'Current statistics suggest that the Milky Way contains', answer: 'C' },
      { type: 'ending', group: 'E3', prompt: 'For the first time in history, humanity now possesses', answer: 'B' }
    ]
  };

  /* ==========================================================
     Assembly + validation
     ========================================================== */
  function wc(text) { return String(text || '').trim().split(/\s+/).filter(Boolean).length; }

  function countWords(parts) {
    return parts.reduce((sum, p) =>
      sum + p.paragraphs.reduce((s, par) => s + wc(par.text), 0), 0);
  }

  function buildTest(parts, source = 'builtin') {
    let n = 0;
    const normParts = parts.map(p => ({
      title: p.title,
      paragraphs: p.paragraphs.map(par => ({ letter: par.letter, text: par.text })),
      questions: p.questions.map(q => ({
        n: ++n,
        type: q.type,
        prompt: q.prompt,
        options: q.options || null,
        group: (q.group && q.group !== 'S1' && q.group !== 'S2' && q.group !== 'H2' && q.group !== 'F2'
                && q.group !== 'I3' && q.group !== 'E3') ? q.group : resolveGroup(p, q),
        allow: q.allow || defaultAllow(q.type),
        answer: q.answer
      }))
    }));
    return {
      source,
      createdAt: new Date().toISOString(),
      titles: normParts.map(p => p.title),
      parts: normParts,
      totalQuestions: n,
      words: countWords(normParts)
    };
  }

  function resolveGroup(part, q) {
    if (!q.group || typeof q.group !== 'object') {
      const found = part.questions.find(x => x.type === q.type && x.group && typeof x.group === 'object');
      return found ? found.group : null;
    }
    return q.group;
  }

  function defaultAllow(type) {
    return (type === 'fill' || type === 'short') ? 'ONE WORD ONLY' : null;
  }

  const VALID_TYPES = ['tfng', 'ynng', 'mcq', 'heading', 'info', 'ending', 'fill', 'short'];
  const MATCHING_TYPES = ['heading', 'info', 'ending'];

  function validateTest(test) {
    const errs = [];
    if (!test || !Array.isArray(test.parts) || test.parts.length !== 3) errs.push('Test must have exactly 3 parts.');
    let n = 0;
    (test.parts || []).forEach((p, pi) => {
      if (!p.title) errs.push(`Part ${pi + 1}: missing title.`);
      if (!Array.isArray(p.paragraphs) || p.paragraphs.length < 3) errs.push(`Part ${pi + 1}: needs 3+ paragraphs.`);
      (p.questions || []).forEach(q => {
        n++;
        if (!VALID_TYPES.includes(q.type)) errs.push(`Q${n}: bad type "${q.type}".`);
        if (!q.prompt || !String(q.prompt).trim()) errs.push(`Q${n}: missing prompt.`);
        if (q.answer == null || String(Array.isArray(q.answer) ? q.answer[0] : q.answer).trim() === '')
          errs.push(`Q${n}: missing answer key.`);
        if (q.type === 'mcq' && (!Array.isArray(q.options) || q.options.length < 3)) errs.push(`Q${n}: MCQ needs 3+ options.`);
        if (MATCHING_TYPES.includes(q.type)) {
          const g = q.group;
          if (!g || !Array.isArray(g.pool) || g.pool.length < 3) errs.push(`Q${n} (${q.type}): matching group needs a pool.`);
        }
      });
    });
    if (n !== 40) errs.push(`Test has ${n} questions (must be 40).`);
    return { ok: errs.length === 0, errors: errs };
  }

  function builtin() {
    const t = buildTest([P1, P2, P3], 'builtin');
    const v = validateTest(t);
    return v.ok ? t : null;   // hand-checked; validation is a safety net
  }

  /* ==========================================================
     AI GENERATOR — v4
     ========================================================== */
  const GEN_SYSTEM = [
    'You are a senior Cambridge IELTS examination writer who produces authentic Academic Reading material.',
    'You write rigorous, factually coherent passages and questions, and you output ONLY valid JSON — no markdown, no commentary.',
    'You follow required question COUNTS with absolute precision — never add, merge or split questions.'
  ].join(' ');

  /* Target composition per part (13 + 13 + 14 = 40). Counts are
     targets — sanitize + assembly guarantee the exact total. */
  const TYPE_PLANS = [
    { part: 1, count: 13, paras: 5,
      mix: [['tfng', 6], ['fill', 4], ['short', 3]],
      plan: 'first a group of 6 "tfng" statements (at least one TRUE, one FALSE and one NOT GIVEN), then a summary-completion group of exactly 4 "fill" questions (allow "ONE WORD ONLY"; the summary text contains the 4 blanks), then exactly 3 "short" questions (allow "NO MORE THAN THREE WORDS").' },
    { part: 2, count: 13, paras: 5,
      mix: [['mcq', 3], ['heading', 5], ['fill', 5]],
      plan: 'first exactly 3 "mcq" questions (four options A-D each), then a matching-headings group of exactly 5 "heading" questions (Paragraph A to Paragraph E, pool of exactly 8 roman headings i-viii), then a sentence-completion group of exactly 5 "fill" questions (allow "NO MORE THAN TWO WORDS").' },
    { part: 3, count: 14, paras: 6,
      mix: [['info', 4], ['mcq', 4], ['ynng', 4], ['ending', 2]],
      plan: 'first a matching-information group of exactly 4 "info" questions (answers are letters from the pool "A","B","C","D","E","F"), then exactly 4 "mcq" questions (A-D), then exactly 4 "ynng" questions (at least one YES, one NO and one NOT GIVEN), then a matching-endings group of exactly 2 "ending" questions (pool of exactly 5 endings A-E).' }
  ];

  const SCHEMA = `{
  "title": "passage title",
  "paragraphs": [{"letter": "A", "text": "full paragraph text"}],
  "questions": [
    {"type": "tfng", "prompt": "statement to evaluate", "answer": "TRUE|FALSE|NOT GIVEN"},
    {"type": "ynng", "prompt": "statement about the writer's claims", "answer": "YES|NO|NOT GIVEN"},
    {"type": "mcq", "prompt": "question", "options": [{"label": "A", "text": "..."}], "answer": "B"},
    {"type": "heading", "prompt": "Paragraph A", "answer": "iii",
     "group": {"pool": [{"label": "i", "text": "heading text"}]}},
    {"type": "info", "prompt": "description of information", "answer": "C",
     "group": {"pool": ["A", "B", "C", "D", "E", "F"]}},
    {"type": "ending", "prompt": "sentence stem", "answer": "D",
     "group": {"pool": [{"label": "A", "text": "ending text"}]}},
    {"type": "fill", "prompt": "sentence with the blank clearly indicated by ______", "answer": "word",
     "group": {"title": "instruction line", "allow": "ONE WORD ONLY", "text": "optional summary text with (n) ______ blanks"}},
    {"type": "short", "prompt": "question", "answer": "answer phrase",
     "group": {"title": "instruction line", "allow": "NO MORE THAN THREE WORDS"}}
  ]
}`;

  function passagePrompt(topic, partNo, startN, feedback) {
    const tp = TYPE_PLANS[partNo - 1];
    const lastLetter = tp.paras === 6 ? 'F' : 'E';
    const checklist = tp.mix.map(([t, c]) => `   • "${t}" — EXACTLY ${c}`).join('\n');
    return `Write ONE complete IELTS Academic Reading section as JSON.

PART ${partNo} of 3 · Question numbers ${startN}–${startN + tp.count - 1} · TOPIC: "${topic}"
 ${partNo > 1 ? `Continuity: the earlier part(s) of this test already cover related aspects of the topic — make this a DISTINCT, self-contained passage.\n` : ''}
 ${feedback ? `*** YOUR PREVIOUS ATTEMPT WAS REJECTED — FIX REQUIRED ***\n${feedback}\nReturn the FULL corrected JSON now.\n` : ''}
RULES:
1. Passage: 700–850 words, EXACTLY ${tp.paras} paragraphs labelled A–${lastLetter}. Academic register, factual, coherent — every question must be answerable from the text alone.
2. QUESTION COUNT — IMPORTANT:
   The "questions" array should contain EXACTLY ${tp.count} items, composed as:
 ${checklist}
   Total for this part = ${tp.count}. Do not add, merge or split questions.
3. CRITICAL for matching types: every "heading", "info" and "ending" question MUST carry a "group" object whose "pool" array has at least 3 entries. Put the FULL pool on the FIRST question of the group.
4. CRITICAL for "mcq": every question needs its own "options" array with exactly 4 entries {label, text}.
5. Types "fill" and "short": put the instruction in the FIRST question's group (title + allow).
6. "tfng": at least one TRUE, one FALSE and one NOT GIVEN. "ynng": at least one YES, one NO and one NOT GIVEN.
7. Every answer must be unambiguous from the passage. Spread correct-option letters for MCQs.
8. Paragraph texts and prompts must be plain text (no markdown). Use straight apostrophes.

MANDATORY FINAL CHECK: count the items in your "questions" array. It must equal EXACTLY ${tp.count}.

Respond with ONLY one JSON object in this schema:
 ${SCHEMA}`;
  }

  /* ---------- normalization helpers ---------- */
  function countByType(qs) {
    const c = {};
    (qs || []).forEach(q => { const t = q.type || 'undefined'; c[t] = (c[t] || 0) + 1; });
    return c;
  }

  const TFN_MAP = {
    'true': 'TRUE', 'false': 'FALSE',
    'not given': 'NOT GIVEN', 'notgiven': 'NOT GIVEN', 'ng': 'NOT GIVEN',
    'yes': 'YES', 'no': 'NO'
  };
  const VALID_TFN = ['TRUE', 'FALSE', 'NOT GIVEN', 'YES', 'NO'];

  function normalizeTFN(val) {
    const k = String(val == null ? '' : val).trim().toLowerCase().replace(/[.!?\s]+$/, '');
    return TFN_MAP[k] || String(val == null ? '' : val).trim();
  }

  const TYPE_ALIASES = {
    tfng: 'tfng', truefalse: 'tfng', truefalsenotgiven: 'tfng', statement: 'tfng', statements: 'tfng',
    ynng: 'ynng', yesnonotgiven: 'ynng', yesno: 'ynng', writersviews: 'ynng',
    mcq: 'mcq', multiplechoice: 'mcq',
    heading: 'heading', headings: 'heading', matchingheadings: 'heading', matchheadings: 'heading',
    paragraphheadings: 'heading', listofheadings: 'heading',
    info: 'info', matchinginformation: 'info', matchinginfo: 'info', whichparagraph: 'info',
    ending: 'ending', endings: 'ending', matchingendings: 'ending', sentenceendings: 'ending',
    fill: 'fill', completion: 'fill', summarycompletion: 'fill', sentencecompletion: 'fill',
    notecompletion: 'fill', formcompletion: 'fill', tablecompletion: 'fill', gapfill: 'fill', blanks: 'fill',
    short: 'short', shortanswer: 'short', shortanswers: 'short', shortanswerquestions: 'short'
  };
  function normalizeType(t) {
    const k = String(t == null ? '' : t).toLowerCase().replace(/[^a-z]/g, '');
    return TYPE_ALIASES[k] || null;
  }

  const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];
  function roman(i) { return ROMAN[i] || String(i + 1); }

  /* ---------- SANITIZE — repair or drop every structurally
     invalid question BEFORE assembly (fixes "matching group
     needs a pool" and friends at the source) ---------- */
  function validPool(g) {
    return !!(g && typeof g === 'object' && Array.isArray(g.pool) && g.pool.length >= 3);
  }

  function normalizePoolEntries(type, pool) {
    const out = (pool || []).map((op, i) => {
      if (typeof op === 'string') {
        const s = op.trim();
        if (!s) return null;
        return { label: type === 'heading' ? roman(i) : String.fromCharCode(65 + i), text: s };
      }
      if (op && typeof op === 'object') {
        const label = String(op.label || (type === 'heading' ? roman(i) : String.fromCharCode(65 + i))).trim();
        const text = String(op.text || '').trim();
        return (label && text) ? { label, text } : null;
      }
      return null;
    }).filter(Boolean);
    return out.length >= 3 ? out : null;
  }

  function sanitizePart(part, partNo) {
    /* paragraphs: accept strings, assign letters if missing */
    part.paragraphs = (part.paragraphs || []).map((p, i) => {
      if (typeof p === 'string') return { letter: String.fromCharCode(65 + i), text: p };
      if (!p.letter) p.letter = String.fromCharCode(65 + i);
      return p;
    }).filter(p => p && p.text && String(p.text).trim());

    /* 1 · normalize question types via alias map; drop unknown */
    let qs = part.questions.map(q => {
      const t = normalizeType(q.type);
      return t ? Object.assign(q, { type: t }) : null;
    }).filter(Boolean);

    const remove = new Set();
    const canon = {};   // first valid group object per matching type

    /* 2 · matching types: repair pools, then validate answers */
    qs.forEach((q, i) => {
      if (!MATCHING_TYPES.includes(q.type)) return;
      let g = (q.group && typeof q.group === 'object') ? q.group : null;

      if (validPool(g)) {
        const norm = normalizePoolEntries(q.type, g.pool);
        if (norm) { g.pool = norm; }
        else g = null;
      } else {
        g = null;
      }

      if (!g && q.type === 'info' && part.paragraphs.length >= 3) {
        /* synthesize the info pool from the passage's paragraph letters */
        g = {
          title: 'Which paragraph contains the following information? Choose from the paragraph letters.',
          pool: part.paragraphs.map(p => p.letter)
        };
      }

      if (!g && canon[q.type]) {
        g = canon[q.type];   // borrow a valid pool from the same type
      }

      if (g && validPool(g)) {
        q.group = g;
        if (!canon[q.type]) canon[q.type] = g;

        /* answer must map to a pool label (case-insensitive, or by text) */
        const ans = String(q.answer == null ? '' : q.answer).trim();
        const byLabel = g.pool.find(op => String(op.label).toLowerCase() === ans.toLowerCase());
        const byText = !byLabel && g.pool.find(op => op.text.toLowerCase() === ans.toLowerCase());
        if (byLabel) q.answer = byLabel.label;
        else if (byText) q.answer = byText.label;
        else remove.add(i);   // unanswerable mismatch → drop
      } else {
        remove.add(i);        // no pool available anywhere → drop
      }
    });

    /* 3 · mcq: validate options + answer */
    qs.forEach((q, i) => {
      if (remove.has(i) || q.type !== 'mcq') return;
      const opts = (Array.isArray(q.options) ? q.options : [])
        .map(o => (o && typeof o === 'object')
          ? { label: String(o.label || '').trim(), text: String(o.text || '').trim() }
          : null)
        .filter(o => o && o.label && o.text);
      if (opts.length < 3) { remove.add(i); return; }
      q.options = opts;

      const ans = String(q.answer == null ? '' : q.answer).trim();
      const byLabel = opts.find(o => o.label.toLowerCase() === ans.toLowerCase());
      if (byLabel) { q.answer = byLabel.label; return; }
      const m = ans.match(/^([A-Da-d])\b/);
      const byLetter = m && opts.find(o => o.label.toLowerCase() === m[1].toLowerCase());
      if (byLetter) { q.answer = byLetter.label; return; }
      const byText = opts.find(o => o.text.toLowerCase() === ans.toLowerCase());
      if (byText) { q.answer = byText.label; return; }
      remove.add(i);
    });

    /* 4 · tfng/ynng: answers must be valid values */
    qs.forEach((q, i) => {
      if (remove.has(i) || !(q.type === 'tfng' || q.type === 'ynng')) return;
      const a = normalizeTFN(q.answer);
      if (VALID_TFN.includes(a)) q.answer = a;
      else remove.add(i);
    });

    /* 5 · prompts + answers must exist */
    qs.forEach((q, i) => {
      if (remove.has(i)) return;
      if (!q.prompt || !String(q.prompt).trim()) {
        if (q.type === 'fill' && q.group && q.group.text) q.prompt = 'Complete the summary above.';
        else if (q.type === 'tfng' || q.type === 'ynng') { remove.add(i); return; }
        else q.prompt = `Question ${i + 1}`;
      }
      const a = Array.isArray(q.answer) ? q.answer[0] : q.answer;
      if (a == null || String(a).trim() === '') remove.add(i);
    });

    const cleaned = qs.filter((_, i) => !remove.has(i));
    if (cleaned.length !== part.questions.length) {
      console.warn(`[ReadingGen] Part ${partNo}: sanitized ${part.questions.length} → ${cleaned.length} questions ` +
                   `(${part.questions.length - cleaned.length} structurally invalid — top-up will replace them).`);
    }
    part.questions = cleaned;
  }

  /* ---------- one generation attempt for a single part ---------- */
  async function genPart(topic, partNo, startN, feedback, signal) {
    const raw = await AI.request({
      system: GEN_SYSTEM,
      prompt: passagePrompt(topic, partNo, startN, feedback),
      temperature: 0.6,
      maxTokens: 7000,
      signal
    });
    const obj = AI.extractJSON(raw);
    if (!obj.title || !Array.isArray(obj.paragraphs) || !Array.isArray(obj.questions)) {
      throw new Error(`AI returned an invalid structure for passage ${partNo}.`);
    }

    /* propagate the first valid group object of each type to the
       rest of its group — shared references survive trimming */
    const firstGroup = {};
    obj.questions.forEach(q => {
      if (q.group && typeof q.group === 'object') firstGroup[q.type] = q.group;
      else if (firstGroup[q.type]) q.group = firstGroup[q.type];
    });

    /* normalize statement answers + fill missing prompts */
    obj.questions.forEach((q, i) => {
      if (typeof q.answer === 'string') q.answer = normalizeTFN(q.answer);
      if (!q.prompt || !String(q.prompt).trim()) {
        q.prompt = (q.type === 'fill' && q.group && q.group.text) ? 'Complete the summary above.' : `Question ${i + 1}`;
      }
    });

    /* v4: full structural repair before the part is accepted */
    sanitizePart(obj, partNo);

    return obj;
  }

  /* ---------- retry wrapper: structural failures only; a part
     that never yields valid questions keeps its passage and is
     filled by the assembly top-up (never dead-ends) ---------- */
  async function genPartWithRetry(topic, partNo, startN, { onStep = () => {}, signal } = {}) {
    const MAX_ATTEMPTS = 3;
    let feedback = '';
    let lastPart = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const part = await genPart(topic, partNo, startN, feedback, signal);
        lastPart = part;

        if (part.questions.length === 0) {
          feedback = 'Your previous response contained no structurally valid questions (wrong shapes, missing pools or options). ' +
                     'Return the complete JSON object exactly in the requested schema.';
          onStep(partNo - 1, 'active', `retry ${attempt} — repairing questions`);
          continue;
        }

        const tp = TYPE_PLANS[partNo - 1];
        if (part.questions.length !== tp.count) {
          console.warn(`[ReadingGen] Part ${partNo}: AI returned ${part.questions.length} questions ` +
                       `(target ${tp.count}) — accepted; assembly will balance the total.`);
        }
        return part;

      } catch (e) {
        feedback = 'Your previous response was rejected because: ' + (e.message || 'invalid output') +
                   ' Return the complete, valid JSON object now.';
        onStep(partNo - 1, 'active', `retry ${attempt} — fixing output`);
      }
    }

    if (lastPart) {
      console.warn(`[ReadingGen] Part ${partNo}: keeping passage with ${lastPart.questions.length} valid questions ` +
                   `after ${MAX_ATTEMPTS} attempts — assembly top-up will fill the rest.`);
      return lastPart;
    }
    throw new Error(`Passage ${partNo} could not be generated after ${MAX_ATTEMPTS} attempts. ` +
                    `Please generate again, or use the built-in test.`);
  }

  /* ---------- safe global trim to an exact target ---------- */
  const TRIM_RANK = { tfng: 0, ynng: 0, mcq: 0, short: 0, info: 1, ending: 1, heading: 1 };
  function qRank(q) {
    if (q.type === 'fill') return (q.group && q.group.text) ? 3 : 2;
    return TRIM_RANK[q.type] != null ? TRIM_RANK[q.type] : 2;
  }

  function trimPartsTo(parts, target) {
    let excess = parts.reduce((s, p) => s + p.questions.length, 0) - target;
    if (excess <= 0) return true;
    for (let rank = 0; rank <= 3 && excess > 0; rank++) {
      const pool = [];
      parts.forEach((p, pi) => p.questions.forEach((q, qi) => {
        if (qRank(q) === rank) pool.push({ pi, qi });
      }));
      pool.sort((a, b) => b.qi - a.qi);           // remove from the end of each part
      for (const { pi, qi } of pool) {
        if (excess <= 0) break;
        parts[pi].questions.splice(qi, 1);
        excess--;
      }
    }
    return excess === 0;
  }

  /* ---------- targeted AI top-up (small, reliable requests) ---------- */
  async function topUpChunk(part, need, signal) {
    const passage = part.paragraphs.map(p => `${p.letter}. ${p.text}`).join('\n\n').slice(0, 9000);
    const existing = part.questions.filter(q => q.type === 'tfng').map(q => `- ${q.prompt}`);

    const prompt = `You are extending an existing IELTS Academic Reading section.

PASSAGE "${part.title}":
 ${passage}

 ${existing.length
  ? `EXISTING "tfng" statements (do NOT repeat or paraphrase any of them):\n${existing.join('\n')}`
  : 'There are no existing "tfng" statements yet.'}

Write EXACTLY ${need} NEW "tfng" statements about this passage — a mix of TRUE, FALSE and NOT GIVEN (include at least one NOT GIVEN). Each statement must be decisively verifiable from the passage alone. Plain text, straight apostrophes.

Respond with ONLY one JSON object, exactly in this shape:
{"questions": [{"type": "tfng", "prompt": "statement text", "answer": "TRUE"}, ... ${need} items total]}`;

    const raw = await AI.request({
      system: GEN_SYSTEM,
      prompt,
      temperature: 0.5,
      maxTokens: 1400,
      signal
    });
    const obj = AI.extractJSON(raw);
    const arr = Array.isArray(obj && obj.questions) ? obj.questions : [];
    return arr
      .map(q => q && q.prompt && String(q.prompt).trim()
        ? { type: 'tfng', prompt: String(q.prompt).trim(), answer: normalizeTFN(q.answer) }
        : null)
      .filter(q => q && VALID_TFN.includes(q.answer))
      .slice(0, need);
  }

  /* ---------- full test: 3 parts → force total to exactly 40 ---------- */
  async function gen(dayPlan, { onStep = () => {}, signal } = {}) {
    const topic = dayPlan.reading.topic;
    const offsets = [0, 13, 27];
    const parts = [];
    for (let i = 1; i <= 3; i++) {
      onStep(i - 1, 'active');
      try {
        parts.push(await genPartWithRetry(topic, i, offsets[i - 1] + 1, { onStep, signal }));
        onStep(i - 1, 'done');
      } catch (e) {
        onStep(i - 1, 'error');
        throw e;
      }
    }

    /* ---- ASSEMBLY: guarantee exactly 40 ---- */
    onStep(3, 'active');
    const total = () => parts.reduce((s, p) => s + p.questions.length, 0);
    let t = total();

    if (t > 40) {
      const ok = trimPartsTo(parts, 40);
      if (!ok) {
        onStep(3, 'error');
        throw new Error(`The AI wrote too many locked questions (${t}) to trim to 40 safely. Please generate again, or use the built-in test.`);
      }
      console.warn(`[ReadingGen] assembly trim: ${t} → ${total()} questions.`);
      t = total();
    }

    if (t < 40) {
      let need = 40 - t;
      let guard = 0;
      while (need > 0 && guard < 5) {
        guard++;
        const chunk = Math.min(need, 6);
        const host = parts.reduce((a, b) => (b.questions.length < a.questions.length ? b : a)); // shortest part
        onStep(3, 'active', `top-up +${chunk} question${chunk === 1 ? '' : 's'}`);
        let added = [];
        try { added = await topUpChunk(host, chunk, signal); }
        catch (e) { console.warn('[ReadingGen] top-up attempt failed:', e.message); }
        if (!added.length) break;
        host.questions.push(...added);
        need -= added.length;
      }
      if (need > 0) {
        onStep(3, 'error');
        throw new Error(`The AI produced ${total()} of 40 questions and the top-up did not complete. Please generate again, or use the built-in test.`);
      }
      console.warn(`[ReadingGen] assembly top-up: ${t} → ${total()} questions.`);
    }

    const test = buildTest(parts, 'ai');
    const v = validateTest(test);
    if (!v.ok) { onStep(3, 'error'); throw new Error('Generated test failed validation: ' + v.errors[0]); }
    onStep(3, 'done');
    return test;
  }

  return { builtin, gen, buildTest, validateTest, countWords, wc, TYPE_PLANS };
})();