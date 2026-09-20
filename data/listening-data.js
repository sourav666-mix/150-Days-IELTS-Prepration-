/* ============================================================
   IELTS PRO 150 — Listening Bank  (v3 — FINAL, self-healing)
   1) LAudio v3 — quality-ranked Web-Speech engine (Natural/
      Neural voices preferred, robotic voices penalised,
      Settings-driven voice mode/speed/pitch).
   2) ListeningBank.builtin() — complete offline test.
   3) ListeningBank.gen() — self-healing AI generator:
      soft counts · sanitize · per-section trim/top-up with
      verbatim-verified answers · real errors surfaced.
   ============================================================ */

'use strict';

/* ==========================================================
   AUDIO ENGINE v3 — quality-ranked Web-Speech player
   ========================================================== */
const LAudio = (() => {

  let session = 0;         // playback generation (kills stale async chains)
  let queue = [];          // [{speaker, text}]
  let idx = 0;
  let rate = 0.95;
  let userRateSet = false; // true once the user picks a speed this visit
  let state = 'idle';      // idle | playing | paused | done
  let supported = ('speechSynthesis' in window) && ('SpeechSynthesisUtterance' in window);
  let voices = [];
  let listeners = {};

  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  function emit(evt, data) { (listeners[evt] || []).forEach(fn => { try { fn(data); } catch {} }); }

  /* ---------- settings ---------- */
  function settings() {
    try { return Store.getSettings(); } catch { return {}; }
  }
  function getRate() {
    const r = parseFloat(settings().listenRate);
    return (isFinite(r) && r >= 0.5 && r <= 1.5) ? r : 0.95;
  }
  function voiceMode() { return settings().listenVoiceMode || 'auto'; }   // 'auto' | 'best'
  function pitchVar()  { return settings().listenPitchVar !== false; }    // default ON

  function refreshVoices() {
    if (!supported) return;
    voices = speechSynthesis.getVoices().filter(v => /^en([-_]|$)/i.test(v.lang));
    if (!voices.length) voices = speechSynthesis.getVoices().slice(0, 2);
  }
  if (supported) {
    refreshVoices();
    speechSynthesis.addEventListener ? speechSynthesis.addEventListener('voiceschanged', refreshVoices)
                                     : (speechSynthesis.onvoiceschanged = refreshVoices);
  }

  /* ---------- voice quality ranking ---------- */
  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  const BAD_RE  = /espeak|compact|robosoft|festival|pico|flite|rhvoice|novel|robot|metal/;
  const NEURAL_RE = /natural|neural|premium|enhanced|siri|wavenet|journey|studio/;
  const OK_RE   = /google|microsoft|online|eloquence/;

  function scoreVoice(v) {
    const n = (v.name || '').toLowerCase();
    let s = 0;
    if (n.indexOf('natural') !== -1) s += 100;       // Edge "Online (Natural)" — best free voices
    else if (NEURAL_RE.test(n))      s += 70;        // neural/premium class
    if (OK_RE.test(n))               s += 20;
    if (n.indexOf('online') !== -1)  s += 25;        // cloud-rendered > local SAPI
    if (v.localService === false)    s += 8;
    if (BAD_RE.test(n))              s -= 90;        // robotic engines
    if (v.lang === 'en-GB' || /^en-GB/i.test(v.lang || '')) s += 25;   // IELTS = British
    else if (v.lang === 'en-US' || v.lang === 'en-AU')      s += 12;
    else if (/^en/i.test(v.lang || ''))                     s += 4;
    return s;
  }

  function rankedVoices() {
    if (!voices.length) return [];
    return voices.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a));
  }

  function voiceFor(speaker) {
    const ranked = rankedVoices();
    if (!ranked.length) return null;
    if (voiceMode() === 'best' || ranked.length === 1) return ranked[0];
    const pool = ranked.slice(0, Math.min(4, ranked.length));
    /* if the best voice clearly outclasses the rest (e.g. the only
       Natural voice among robotic ones), use it for everyone */
    if (scoreVoice(pool[0]) - scoreVoice(pool[pool.length - 1]) >= 80) return pool[0];
    return pool[hashStr(speaker || 'X') % pool.length];
  }

  function pitchFor(speaker) {
    if (!speaker || !pitchVar()) return 1;
    return [0.92, 1.08, 1.0, 0.95, 1.1][hashStr(speaker) % 5];
  }

  /* Build sentence queue from transcript lines ("SPEAKER: text" or plain) */
  function splitSentences(text) {
    const parts = String(text).match(/[^.!?…]+[.!?…]+["'\u201D]?\s*/g);
    return (parts || [String(text)]).map(s => s.trim()).filter(Boolean);
  }
  function load(lines) {
    queue = [];
    (lines || []).forEach(line => {
      const m = String(line).match(/^([A-Z][A-Z0-9 _-]{1,24}):\s*(.+)$/);
      const speaker = m ? m[1].trim() : null;
      const text = m ? m[2] : String(line);
      splitSentences(text).forEach(s => queue.push({ speaker, text: s }));
    });
    idx = 0;
    state = 'idle';
    if (!userRateSet) rate = getRate();   // re-sync with saved Settings
    emit('state');
  }

  function utter(text, speaker, my) {
    return new Promise((resolve, reject) => {
      if (!supported) return reject(new Error('no-tts'));
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate;
      u.pitch = pitchFor(speaker);
      u.volume = 1;
      u.lang = 'en-GB';
      const v = voiceFor(speaker);
      if (v) u.voice = v;
      let settled = false;
      u.onend = () => { if (!settled) { settled = true; resolve(); } };
      u.onerror = (ev) => {
        if (!settled) { settled = true; reject(new Error(ev.error || 'speech-error')); }
      };
      speechSynthesis.speak(u);
      /* safety: if engine silently drops the utterance */
      setTimeout(() => {
        if (!settled && !speechSynthesis.speaking && !speechSynthesis.pending) {
          settled = true; resolve();
        }
      }, 30000);
    });
  }

  async function step(my) {
    if (my !== session) return;
    if (idx >= queue.length) { state = 'done'; emit('state'); emit('progress', { idx, total: queue.length }); return; }
    const it = queue[idx];
    emit('sentence', { idx, total: queue.length, item: it, state });
    try {
      await utter(it.text, it.speaker, my);
      if (my !== session) return;
      idx++;
      step(my);
    } catch (e) {
      if (my !== session) return;
      if (e.message === 'interrupted' || e.message === 'canceled') return;
      state = 'idle'; emit('state'); emit('error', e);
    }
  }

  function play() {
    if (!supported || !queue.length) return;
    if (state === 'paused') return resume();
    session++; speechSynthesis.cancel();
    if (!userRateSet) rate = getRate();
    if (idx >= queue.length) idx = 0;
    state = 'playing';
    emit('state'); emit('playcount');
    const my = session;
    step(my);
  }
  function pause() {
    if (state !== 'playing') return;
    session++; speechSynthesis.cancel();
    state = 'paused'; emit('state'); emit('sentence', { idx, total: queue.length, item: queue[idx] || null, state });
  }
  function resume() {
    if (state !== 'paused') return;
    state = 'playing'; emit('state');
    const my = session;
    step(my);
  }
  function stop() {
    if (!supported) return;
    session++; speechSynthesis.cancel();
    state = 'idle'; idx = 0;
    emit('state'); emit('sentence', { idx: 0, total: queue.length, item: queue[0] || null, state });
  }
  function skip(delta) {
    idx = clamp(idx + delta, 0, Math.max(0, queue.length - 1));
    if (state === 'playing') { session++; emit('state'); const my = session; step(my); }
    else emit('sentence', { idx, total: queue.length, item: queue[idx] || null, state });
  }
  function setRate(r) { rate = r; userRateSet = true; }
  function status() { return { state, idx, total: queue.length, supported }; }

  /* ---------- Settings helpers ---------- */
  function speakTest(text) {
    return new Promise((resolve, reject) => {
      if (!supported) return reject(new Error('no-tts'));
      speechSynthesis.cancel();
      rate = getRate();
      const u = new SpeechSynthesisUtterance(text || 'This is how your listening recordings will sound. The winding river passed beneath the old stone bridge.');
      u.rate = rate; u.pitch = pitchFor('TEST'); u.lang = 'en-GB';
      const v = voiceFor('TEST');
      if (v) u.voice = v;
      u.onend = resolve; u.onerror = (e) => reject(new Error(e.error || 'speech-error'));
      speechSynthesis.speak(u);
    });
  }
  function ranked() {
    return rankedVoices().slice(0, 5).map(v =>
      ({ name: v.name, lang: v.lang, score: scoreVoice(v) }));
  }

  return { supported: () => supported, load, play, pause, resume, stop, skip, setRate, status, on, speakTest, ranked };
})();

/* ==========================================================
   BUILT-IN TEST — Day-1 scenarios, 40 questions
   ========================================================== */
const ListeningBank = (() => {

  const S1 = {
    num: 1, scenario: 'Hotel booking for a wedding party', context: 'Social · Conversation', conversation: true,
    transcript: [
      'AGENT: Good morning, Lakeside Hotel, reservations desk. How can I help you?',
      'CALLER: Hello. I\u2019m organising accommodation for my sister\u2019s wedding, and I\u2019d like to book rooms for the wedding party, please.',
      'AGENT: Congratulations to your sister! Let me take the details. How many guests will need rooms?',
      'CALLER: There are nineteen people altogether, including the bride and groom.',
      'AGENT: Nineteen guests. And what type of rooms would you like? We have single rooms, double rooms, and family rooms that sleep up to four people.',
      'CALLER: Family rooms would be ideal, actually \u2014 quite a few guests are bringing children.',
      'AGENT: Family rooms it is. And what date will the party be arriving?',
      'CALLER: On the twelfth of August.',
      'AGENT: The twelfth of August. And how many nights will you be staying with us?',
      'CALLER: Just two nights. The wedding is on the Saturday, so everyone will be leaving on the Monday morning.',
      'AGENT: Two nights from the twelfth of August. Now, one thing I should mention \u2014 we have a lovely garden at the back of the hotel, and many wedding parties reserve it for photographs. It\u2019s free of charge for our guests.',
      'CALLER: Oh, that sounds perfect. Yes, please reserve the garden for us. We\u2019ll need it on the Saturday afternoon.',
      'AGENT: Consider it done. Could I take a contact telephone number, please?',
      'CALLER: Of course. It\u2019s 07700 900431.',
      'AGENT: So that\u2019s zero seven seven zero zero, nine zero zero four three one. Let me read the whole booking back to you. Nineteen guests in family rooms, arriving on the twelfth of August for two nights, and the garden reserved for photographs on the Saturday afternoon.',
      'CALLER: That\u2019s all correct.',
      'AGENT: Lovely. Now, where would you like the wedding breakfast to be served? We have three options. The garden room is our smallest space and really only suits parties of up to ten. The riverside terrace is very popular in summer because of the view, but the old ballroom is the coolest room in the hotel in August, and with nineteen guests I\u2019d strongly recommend it.',
      'CALLER: We\u2019ll trust your judgement \u2014 let\u2019s go with the ballroom.',
      'AGENT: Good choice. To confirm the booking I\u2019ll need a deposit. If you book through the website, the deposit is taken immediately at the time of booking, but as you\u2019re booking by phone, you can simply transfer the deposit to our account within seven days, and the balance is paid on arrival.',
      'CALLER: I\u2019ll arrange the transfer today, then.',
      'AGENT: Perfect. And before I let you go \u2014 we\u2019re running a special offer for wedding parties. If you confirm before the end of May, the bridal suite is complimentary on the wedding night. After May, that particular offer ends, but you would still qualify for our group discount, which applies to any booking of six rooms or more.',
      'CALLER: Nineteen guests \u2014 we\u2019ll have well over six rooms, so that\u2019s good news either way.',
      'AGENT: Exactly. And is there anything else I can help with?',
      'CALLER: Just one thing \u2014 is there parking at the hotel?',
      'AGENT: There is. Guest parking behind the hotel is completely free. There\u2019s also a car park in the market square, about five minutes away, but that one is pay-and-display, and I\u2019m afraid we don\u2019t have any underground parking, as the building is listed.',
      'CALLER: Free parking behind the hotel \u2014 brilliant. Thank you so much for your help.',
      'AGENT: You\u2019re very welcome. We look forward to seeing you all in August. Goodbye!',
      'CALLER: Goodbye.'
    ],
    groups: [
      { title: 'Questions 1\u20136', type: 'fill',
        instruction: 'Complete the form below. Write ONE WORD AND/OR A NUMBER for each answer.',
        allow: 'ONE WORD AND/OR A NUMBER', formTitle: 'WEDDING PARTY BOOKING \u2014 LAKESIDE HOTEL',
        questions: [
          { label: 'Total number of guests needing rooms', answer: '19', accepts: ['nineteen'] },
          { label: 'Room type required', answer: 'family' },
          { label: 'Arrival date: 12 ______', answer: 'August' },
          { label: 'Number of nights', answer: ['two', '2'] },
          { label: 'Free facility reserved for photographs: the hotel ______', answer: 'garden' },
          { label: 'Contact telephone number', answer: ['07700 900431', '07700900431'] }
        ] },
      { title: 'Questions 7\u201310', type: 'mcq',
        instruction: 'Choose the correct letter, A, B or C.',
        questions: [
          { prompt: 'The wedding breakfast will be served in',
            options: [ { label: 'A', text: 'the garden room' }, { label: 'B', text: 'the riverside terrace' }, { label: 'C', text: 'the old ballroom' } ],
            answer: 'C' },
          { prompt: 'The deposit must be paid',
            options: [ { label: 'A', text: 'within seven days' }, { label: 'B', text: 'on arrival' }, { label: 'C', text: 'at the time of online booking' } ],
            answer: 'A' },
          { prompt: 'The group discount applies to any booking of',
            options: [ { label: 'A', text: 'through a travel agency' }, { label: 'B', text: 'six rooms or more' }, { label: 'C', text: 'before the end of May' } ],
            answer: 'B' },
          { prompt: 'Parking at the hotel is',
            options: [ { label: 'A', text: 'free behind the hotel' }, { label: 'B', text: 'pay-and-display in the market square' }, { label: 'C', text: 'available underground' } ],
            answer: 'A' }
        ] }
    ]
  };

  const S2 = {
    num: 2, scenario: 'Radio tour of a covered market', context: 'Social · Monologue', conversation: false,
    transcript: [
      'PRESENTER: Good evening, and welcome to \u201CAround Our City\u201D, the programme that takes you to a different corner of the city each week. I\u2019m standing in the main hall of the Greenmarket, which reopened this spring after a two-year restoration. The market first opened in 1863, though there has been a market of some kind on this site since 1780, when local farmers brought their produce into town every Thursday.',
      'PRESENTER: Today the main hall is home to over sixty stalls selling fruit, vegetables, cheese and flowers, and the whole building now has heating for the first time in its history. The market is open six days a week, from eight in the morning until six, and it is closed on Mondays only \u2014 so you can visit any day from Tuesday to Sunday, including public holidays.',
      'PRESENTER: On the upper floor you\u2019ll find a restaurant with views over the main hall. What makes it special is that the chefs buy all their ingredients from the stalls downstairs, so the menu changes according to whatever the farmers bring in that morning. Nothing is frozen, and nothing is imported from abroad.',
      'PRESENTER: Now, if you\u2019re hoping to pick up a bargain, timing matters. Saturday mornings are the busiest and most atmospheric time to come, but the savviest shoppers know that weekday afternoons \u2014 particularly after two o\u2019clock \u2014 are when stallholders cut prices to clear their stock before closing.',
      'PRESENTER: Behind the main hall, the west wing houses forty stalls of handmade crafts \u2014 jewellery, pottery, woodwork \u2014 all made within fifty miles of the city. The east wing is used for storage and is not open to visitors, though it will be converted into a food court next year.',
      'PRESENTER: One of the most popular attractions is the demonstration kitchen, where local chefs show visitors how to cook with seasonal produce. Free cookery classes are held there every weekend, but places are limited, so you need to book at the information desk when you arrive.',
      'PRESENTER: Getting to the market is easy. The nearest tram stop is Market Street, right outside the west entrance, and the number twelve bus also stops within a two-minute walk. There is no car park at the market itself, so most people leave the car at home.',
      'PRESENTER: Before I hand back to the studio, one last thing. Every evening, the leftover food is collected by a local charity and distributed to families in need \u2014 last year alone, that amounted to more than forty tonnes of good food that would otherwise have been wasted. And if you want to plan your visit, there\u2019s a free map of the market on the website, showing all the stalls and facilities. You can print it at home or pick up a copy at the information desk. Back to you in the studio!'
    ],
    groups: [
      { title: 'Questions 11\u201314', type: 'mcq', instruction: 'Choose the correct letter, A, B or C.',
        questions: [
          { prompt: 'The market building itself first opened in',
            options: [ { label: 'A', text: '1780' }, { label: 'B', text: '1863' }, { label: 'C', text: 'this spring' } ],
            answer: 'B' },
          { prompt: 'The market is closed on',
            options: [ { label: 'A', text: 'Mondays' }, { label: 'B', text: 'Sundays' }, { label: 'C', text: 'public holidays' } ],
            answer: 'A' },
          { prompt: 'The upstairs restaurant uses',
            options: [ { label: 'A', text: 'frozen ingredients' }, { label: 'B', text: 'produce from the market stalls' }, { label: 'C', text: 'imported food' } ],
            answer: 'B' },
          { prompt: 'The best time to visit for bargains is',
            options: [ { label: 'A', text: 'early on Saturday mornings' }, { label: 'B', text: 'Saturday afternoons' }, { label: 'C', text: 'weekday afternoons' } ],
            answer: 'C' }
        ] },
      { title: 'Questions 15\u201320', type: 'fill',
        instruction: 'Complete the notes below. Write ONE WORD ONLY for each answer.',
        allow: 'ONE WORD ONLY', notes: true, notesTitle: 'THE GREENMARKET \u2014 VISITOR NOTES',
        questions: [
          { label: 'Main hall: over sixty stalls sell fruit, vegetables, cheese and', answer: 'flowers' },
          { label: 'The wing for handmade crafts is the', answer: 'west' },
          { label: 'Free weekend cookery classes in the demonstration kitchen \u2014 book at the desk', answer: 'information' },
          { label: 'Nearest stop for the tram:', answer: 'Market Street', accepts: ['market st', 'market street'] },
          { label: 'Leftover food collected each evening by a local', answer: 'charity' },
          { label: 'A free map of the market is available on the', answer: 'website' }
        ] }
    ]
  };

  const S3 = {
    num: 3, scenario: 'Tutor and two students: research assignment', context: 'Academic · Discussion', conversation: true,
    transcript: [
      'TUTOR: Come in, James, Priya \u2014 good, we have the room to ourselves. So, the research assignment. Tell me where you\u2019ve got to.',
      'PRIYA: Well, we\u2019ve settled on a topic \u2014 food waste in the university canteen. We want to find out how much food students throw away, and why.',
      'TUTOR: Excellent choice. Much more focused than city transport or renewable energy, which half the class chose. Now, you mentioned you ran a first survey last week. How did that go?',
      'JAMES: Not brilliantly. We got plenty of responses \u2014 over two hundred \u2014 but when we looked at the answers, people seemed confused, and a couple of them said the questions sort of pushed them towards an answer.',
      'TUTOR: Ah \u2014 leading questions. It\u2019s a classic first attempt. The phrasing suggested the answer you wanted, so the data isn\u2019t much use, I\u2019m afraid. The response numbers weren\u2019t the problem at all.',
      'PRIYA: So we\u2019ve rewritten the whole questionnaire, and this time we\u2019ve asked a friend outside the course to check that nothing sounds biased.',
      'TUTOR: Very sensible. Now \u2014 the new plan. Who\u2019s doing what?',
      'JAMES: Well, someone needs to actually run the paper survey at lunchtime, standing in the canteen and collecting the responses. I\u2019m happy to do that \u2014 I\u2019ve got a big free period on Tuesdays and Thursdays.',
      'TUTOR: Good. And the online version?',
      'PRIYA: I\u2019ll take care of that. I\u2019ve already started building the online survey \u2014 I\u2019ll finish the design this week and test it on a few classmates first.',
      'TUTOR: Excellent. Now, you\u2019ll need permission to work in the canteen, and to speak to the kitchen team. I know the catering manager well, so I\u2019ll email her today and arrange canteen access for you both. James, when you interview the catering staff about why leftovers happen, she\u2019ll set that up too.',
      'JAMES: Thanks. We\u2019d also like to take photographs of the waste bins at the end of lunch service \u2014 we can both do that during our shifts. It\u2019ll be powerful evidence for the report.',
      'PRIYA: As long as we make sure no students are identifiable in the photos.',
      'TUTOR: Right \u2014 get consent where it\u2019s needed. Now, the analysis will come later, once you\u2019ve got the numbers in \u2014 we\u2019ll look at that together in the week after data collection. The important dates: the draft is due on the twenty-fourth of November. Not the tenth \u2014 that\u2019s the proposal deadline. And not the first of December \u2014 that\u2019s the final submission.',
      'JAMES: Got it. Draft on the twenty-fourth of November.',
      'TUTOR: Two more things. The assignment counts for twenty percent of your final mark, so it\u2019s worth taking seriously. And keep copies of all your raw data \u2014 questionnaires, spreadsheets, recordings \u2014 because the external examiner may ask to see it.',
      'PRIYA: We\u2019ll set up a shared folder this evening.',
      'TUTOR: Perfect. Send me the draft when it\u2019s ready and I\u2019ll give you feedback within the week.'
    ],
    groups: [
      { title: 'Questions 21\u201324', type: 'mcq', instruction: 'Choose the correct letter, A, B, C or D.',
        questions: [
          { prompt: 'The students\u2019 assignment topic is',
            options: [ { label: 'A', text: 'city transport' }, { label: 'B', text: 'renewable energy' }, { label: 'C', text: 'food waste' }, { label: 'D', text: 'water quality' } ],
            answer: 'C' },
          { prompt: 'What was the main problem with the students\u2019 first survey?',
            options: [ { label: 'A', text: 'too few students completed it' }, { label: 'B', text: 'some questions pushed people towards answers' }, { label: 'C', text: 'it was completed too quickly' }, { label: 'D', text: 'it was only given online' } ],
            answer: 'B' },
          { prompt: 'James will be responsible for',
            options: [ { label: 'A', text: 'building the online survey' }, { label: 'B', text: 'collecting paper responses in the canteen' }, { label: 'C', text: 'writing the literature review' }, { label: 'D', text: 'analysing the results' } ],
            answer: 'B' },
          { prompt: 'The draft assignment is due on',
            options: [ { label: 'A', text: '10 November' }, { label: 'B', text: '24 November' }, { label: 'C', text: '1 December' }, { label: 'D', text: '14 December' } ],
            answer: 'B' }
        ] },
      { title: 'Questions 25\u201328', type: 'match',
        instruction: 'Who will do each task? Choose FOUR answers from the box and write the correct letter, A\u2013E.',
        pool: [
          { label: 'A', text: 'design the online survey' },
          { label: 'B', text: 'interview the catering staff' },
          { label: 'C', text: 'analyse the results' },
          { label: 'D', text: 'arrange canteen access' },
          { label: 'E', text: 'photograph the waste bins' }
        ],
        questions: [
          { prompt: 'James', answer: 'B' },
          { prompt: 'Priya', answer: 'A' },
          { prompt: 'The tutor', answer: 'D' },
          { prompt: 'Both students', answer: 'E' }
        ] },
      { title: 'Questions 29\u201330', type: 'fill',
        instruction: 'Complete the sentences below. Write ONE WORD ONLY for each answer.',
        allow: 'ONE WORD ONLY', notes: true, notesTitle: null,
        questions: [
          { label: 'The assignment counts for', answer: ['twenty', '20'], label2: 'percent of the final mark.', inline: true },
          { label: 'Students must keep copies of all raw', answer: 'data', label2: 'for the external examiner.', inline: true }
        ] }
    ]
  };

  const S4 = {
    num: 4, scenario: 'Marine biology: life at hydrothermal vents', context: 'Academic · Lecture', conversation: false,
    transcript: [
      'LECTURER: Good morning, everyone. Today we\u2019re looking at one of the most remarkable discoveries in modern marine science: the deep-sea hydrothermal vents. Before 1977, scientists believed the deep ocean floor was a lifeless desert \u2014 too dark, too cold and too poor in nutrients to support more than a few bacteria.',
      'LECTURER: All of that changed when a research vehicle explored the Gal\u00E1pagos Rift, a crack in the ocean floor west of Ecuador, and found entire communities of animals living around jets of hot water rising from the seabed \u2014 the vents.',
      'LECTURER: So what exactly is a hydrothermal vent? Seawater seeps down through cracks in the ocean floor, where it is heated by hot magma beneath the crust. This superheated water then rises again and bursts out through chimney-like openings, and where the vent water is rich in minerals, those chimneys can grow tens of metres tall.',
      'LECTURER: The darkest, hottest vents are known as black smokers, and they get their dramatic colour from tiny particles of metal sulphides \u2014 compounds of iron, copper and zinc \u2014 carried up in the water.',
      'LECTURER: The fluid leaving a black smoker can reach temperatures of around four hundred degrees Celsius. Yet it does not boil, despite being far above the normal boiling point of water. The explanation is pressure: at depths of two thousand metres or more, the water pressure is so enormous that it keeps the fluid liquid.',
      'LECTURER: Now \u2014 how do these animals survive without sunlight? The key is bacteria. In the sunlit world, plants make food from light through photosynthesis. At the vents, bacteria instead use chemical energy: they extract energy from hydrogen sulphide in the vent water and use it to build organic matter, a process called chemosynthesis. Everything else in the community depends, directly or indirectly, on these bacteria.',
      'LECTURER: The most famous vent animal is the giant tube worm, which can grow up to two metres in length. These worms are so strange that they challenged every textbook: they have no mouth and no stomach. Instead, their body cavity is packed with bacteria that make food for them \u2014 the worms simply absorb the chemicals the bacteria need from the water. In effect, the worms are living apartment blocks for their bacterial tenants.',
      'LECTURER: Since that first discovery in 1977, hundreds of vent fields have been found, and most of them lie along the mid-ocean ridges \u2014 the vast underwater mountain chains where new sea floor is created. Each vent field hosts species found nowhere else on Earth, and new species are described almost every year.',
      'LECTURER: Exploring these depths is a formidable engineering challenge. Because divers cannot survive at such depths, scientists rely on deep-sea vehicles \u2014 unmanned robots controlled from the research ship, and occasionally crewed submersibles \u2014 fitted with cameras, robotic arms and sensors.',
      'LECTURER: In our next lecture we\u2019ll look at what happens when a vent field dies \u2014 because vents are temporary, and when they fail, an entire community must find another vent or perish. For Friday, please read the two papers on chemosynthesis in the reading list. Thank you.'
    ],
    groups: [
      { title: 'Questions 31\u201340', type: 'fill',
        instruction: 'Complete the notes below. Write ONE WORD ONLY for each answer.',
        allow: 'ONE WORD ONLY', notes: true, notesTitle: 'HYDROTHERMAL VENTS \u2014 LECTURE NOTES',
        questions: [
          { label: 'Vents discovered in 1977 near the Gal\u00E1pagos', answer: 'Rift' },
          { label: 'Seawater seeps down and is heated by hot', answer: 'magma' },
          { label: 'Black smokers are dark from particles of metal', answer: ['sulphides', 'sulfides'] },
          { label: 'Fluid at 400\u00B0C still does not', answer: 'boil', label2: 'because of the enormous pressure.', inline: true },
          { label: 'Vent bacteria make food using chemical', answer: 'energy', label2: 'instead of sunlight.', inline: true },
          { label: 'Giant tube worms have no mouth and no', answer: 'stomach', accepts: ['gut'] },
          { label: 'The worms depend on', answer: 'bacteria', label2: 'living inside them.', inline: true },
          { label: 'Tube worms can reach two', answer: 'metres', accepts: ['meters'], label2: 'in length.', inline: true },
          { label: 'Most vent fields lie along the mid-ocean', answer: 'ridges' },
          { label: 'Scientists explore vents using deep-sea', answer: 'vehicles', label2: 'controlled from the ship.', inline: true }
        ] }
    ]
  };

  /* ==========================================================
     Assembly + validation
     ========================================================== */
  function wc(text) { return String(text || '').trim().split(/\s+/).filter(Boolean).length; }

  function buildTest(sections, source = 'builtin') {
    let n = 0;
    const norm = sections.map(s => ({
      num: s.num,
      scenario: s.scenario,
      context: s.context,
      conversation: !!s.conversation,
      transcript: (s.transcript || []).map(String),
      groups: (s.groups || [])
        .filter(g => g.questions && g.questions.length)     // drop empty groups (post-trim)
        .map(g => {
          const gqs = g.questions.map(q => ({
            n: ++n,
            type: g.type,
            prompt: q.prompt || null,
            label: q.label || null,
            label2: q.label2 || null,
            inline: !!q.inline,
            options: q.options || null,
            accepts: q.accepts || null,
            answer: q.answer
          }));
          /* regenerate the group title from the real numbers —
             stays correct after sanitize trim / top-up */
          const first = gqs[0].n, last = gqs[gqs.length - 1].n;
          return {
            title: 'Questions ' + first + '\u2013' + last,
            type: g.type,
            instruction: g.instruction || '',
            allow: g.allow || null,
            formTitle: g.formTitle || null,
            notes: !!g.notes,
            notesTitle: g.notesTitle || null,
            pool: g.pool || null,
            questions: gqs
          };
        })
    }));
    return {
      source,
      createdAt: new Date().toISOString(),
      titles: norm.map(s => `Section ${s.num} — ${s.scenario} (${s.context})`),
      sections: norm,
      totalQuestions: n,
      transcriptWords: norm.reduce((t, s) => t + s.transcript.join(' ').split(/\s+/).filter(Boolean).length, 0)
    };
  }

  const VALID_TYPES = ['fill', 'mcq', 'match'];

  function validateTest(test) {
    const errs = [];
    if (!test || !Array.isArray(test.sections) || test.sections.length !== 4) errs.push('Test must have exactly 4 sections.');
    let n = 0;
    (test.sections || []).forEach((s, si) => {
      if (!s.scenario) errs.push(`Section ${si + 1}: missing scenario.`);
      if (!Array.isArray(s.transcript) || !s.transcript.length) errs.push(`Section ${si + 1}: missing transcript.`);
      const tw = (s.transcript || []).join(' ').split(/\s+/).filter(Boolean).length;
      if (tw < 120) errs.push(`Section ${si + 1}: transcript too short (${tw} words).`);
      const qs = [];
      (s.groups || []).forEach(g => {
        if (!VALID_TYPES.includes(g.type)) errs.push(`Section ${si + 1}: bad group type "${g.type}".`);
        if (g.type === 'match' && (!g.pool || g.pool.length < 4)) errs.push(`Section ${si + 1}: match group needs a pool of 4+ options.`);
        (g.questions || []).forEach(q => qs.push(q));
      });
      if (qs.length !== 10) errs.push(`Section ${si + 1}: has ${qs.length} questions (must be 10).`);
      qs.forEach(q => {
        n++;
        if (q.answer == null || String(Array.isArray(q.answer) ? q.answer[0] : q.answer).trim() === '')
          errs.push(`Q${n}: missing answer key.`);
        if (q.type === 'mcq' && (!Array.isArray(q.options) || q.options.length < 3)) errs.push(`Q${n}: MCQ needs 3+ options.`);
        if (q.type === 'fill' && !q.label) errs.push(`Q${n}: fill question needs a label.`);
        if (q.type === 'match' && !q.prompt) errs.push(`Q${n}: match question needs a prompt.`);
        (q.accepts || []).forEach(a => { if (String(a).trim() === '') errs.push(`Q${n}: empty "accepts" entry.`); });
      });
    });
    if (n !== 40) errs.push(`Test has ${n} questions (must be 40).`);
    return { ok: errs.length === 0, errors: errs };
  }

  function builtin() {
    const t = buildTest([S1, S2, S3, S4], 'builtin');
    const v = validateTest(t);
    return v.ok ? t : null;
  }

  /* ==========================================================
     AI GENERATOR — v3 (soft counts + sanitize + balance)
     ========================================================== */
  const GEN_SYSTEM = [
    'You are a senior Cambridge IELTS test writer who produces authentic IELTS Listening material.',
    'You write natural, realistic recordings as transcripts, and you output ONLY valid JSON — no markdown, no commentary.',
    'You follow required question COUNTS with absolute precision — never add, merge or split questions.'
  ].join(' ');

  const BLUEPRINTS = [
    { part: 1, startN: 1, count: 10,
      kind: 'Section 1 — Social context, CONVERSATION between TWO speakers (e.g. a booking or enquiry call).',
      plan: 'Group "Questions 1\u20136": type "fill", allow "ONE WORD AND/OR A NUMBER", each question has a short "label" (form style). Group "Questions 7\u201310": type "mcq" with THREE options A\u2013C each; vary the answer letters.',
      scriptRule: '450\u2013650 words, natural everyday register with authentic hesitations and repetitions. Every fill answer must be heard verbatim; spell names letter-by-letter where relevant; numbers may be spoken digit-by-digit.' },
    { part: 2, startN: 11, count: 10,
      kind: 'Section 2 — Social context, MONOLOGUE by ONE speaker (e.g. a guided radio tour, announcement or induction talk).',
      plan: 'Group "Questions 11\u201314": type "mcq" with THREE options A\u2013C each; vary the answer letters. Group "Questions 15\u201320": type "fill", allow "ONE WORD ONLY", each question has a "label" (notes style).',
      scriptRule: '450\u2013650 words, one fluent speaker addressing an audience. Distractor information must be explicitly mentioned and then corrected, exactly like the real test.' },
    { part: 3, startN: 21, count: 10,
      kind: 'Section 3 — Academic/training context, DISCUSSION between two to four speakers (e.g. a tutor and students planning an assignment).',
      plan: 'Group "Questions 21\u201324": type "mcq" with FOUR options A\u2013D each. Group "Questions 25\u201328": type "match" \u2014 who does each task; the GROUP must contain a "pool" of exactly 5 options A\u2013E, each question has "prompt" (a person) and an answer letter. Group "Questions 29\u201330": type "fill", allow "ONE WORD ONLY".',
      scriptRule: '450\u2013650 words with interruptions, agreements and disagreements clearly attributable to named speakers (use real first names). Answers must be unambiguous.' },
    { part: 4, startN: 31, count: 10,
      kind: 'Section 4 — Academic context, MONOLOGUE: a university LECTURE on the given subject.',
      plan: 'One group "Questions 31\u201340": type "fill", allow "ONE WORD ONLY", each question has a "label" (lecture-notes style). Answers must be single common words present verbatim in the script.',
      scriptRule: '500\u2013700 words, formal academic register with signposting language ("Moving on to...", "The key point here is...").' }
  ];

  const SCHEMA = `{
  "scenario": "short scenario title",
  "context": "Social · Conversation | Social · Monologue | Academic · Discussion | Academic · Lecture",
  "conversation": true,
  "transcript": ["SPEAKER: utterance...", "OTHER: ..."],
  "groups": [
    {"title": "Questions 1-6", "type": "fill",
     "instruction": "Complete the form below. Write ONE WORD AND/OR A NUMBER for each answer.",
     "allow": "ONE WORD AND/OR A NUMBER", "formTitle": "FORM HEADING",
     "questions": [{"label": "Room type required", "answer": "family"}]},
    {"title": "Questions 7-10", "type": "mcq", "instruction": "Choose the correct letter, A, B or C.",
     "questions": [{"prompt": "question", "options": [{"label","text"}], "answer": "B"}]},
    {"title": "Questions 25-28", "type": "match", "instruction": "Choose FOUR answers from the box.",
     "pool": [{"label": "A", "text": "..."}],
     "questions": [{"prompt": "Person", "answer": "B"}]},
    {"title": "Questions 31-40", "type": "fill", "instruction": "Complete the notes below. Write ONE WORD ONLY.",
     "allow": "ONE WORD ONLY", "notes": true, "notesTitle": "NOTES HEADING",
     "questions": [{"label": "note text ending with the missing info", "answer": "word"}]}
  ]
}`;

  function sectionPrompt(scenario, bp, planContext, continuity, feedback) {
    return `Write ONE complete IELTS Listening section as JSON.

 ${bp.kind}
SCENARIO: "${scenario}"
CONTEXT CATEGORY: ${planContext}
Question numbers ${bp.startN}\u2013${bp.startN + bp.count - 1} · EXACTLY ${bp.count} questions.
 ${continuity}

 ${bp.plan}

TRANSCRIPT RULES: ${bp.scriptRule}

STRICT JSON RULES:
1. "transcript": array of utterance strings. Conversations: prefix each utterance with a role in capitals + colon ("AGENT:", "CALLER:", "TUTOR:", "JAMES:"). Monologues: plain strings, no prefix, split into logical paragraphs.
2. "conversation": true for conversations, false for monologues.
3. "groups": array of question groups. Each group: "title" (like "Questions ${bp.startN}-${bp.startN + 5}"), "type" ("fill" | "mcq" | "match"), "instruction", and its "questions" array.
4. CRITICAL for "fill": every question needs {"label": "...", "answer": "..."} — the answer MUST appear VERBATIM in the transcript. Optional "accepts": ["alternative spelling"].
5. CRITICAL for "mcq": every question needs {"prompt", "options": [{"label","text"}...], "answer"} with the exact option count from the plan; letters vary across questions.
6. CRITICAL for "match": the GROUP must carry "pool" with EXACTLY 5 labelled options A\u2013E; each question is {"prompt", "answer"} where answer is one of the pool letters.
7. The TOTAL number of questions across all groups must be EXACTLY ${bp.count}.

MANDATORY FINAL CHECK: count all questions in all groups. It must equal EXACTLY ${bp.count}.

Respond with ONLY one JSON object in this schema:
 ${SCHEMA}`;
  }

  /* ---------- helpers ---------- */
  const uniq = arr => Array.from(new Set(arr));

  function totalQuestions(sec) {
    return (sec.groups || []).reduce((s, g) => s + (g.questions ? g.questions.length : 0), 0);
  }

  const GROUP_ALIASES = {
    fill: 'fill', form: 'fill', formcompletion: 'fill', notecompletion: 'fill', notes: 'fill',
    tablecompletion: 'fill', summarycompletion: 'fill', sentencecompletion: 'fill',
    completion: 'fill', gapfill: 'fill', blanks: 'fill', shortanswer: 'fill',
    mcq: 'mcq', multiplechoice: 'mcq',
    match: 'match', matching: 'match', classification: 'match', matchingfeatures: 'match',
    whodoeswhat: 'match'
  };
  function normalizeGroupType(t) {
    const k = String(t == null ? '' : t).toLowerCase().replace(/[^a-z]/g, '');
    return GROUP_ALIASES[k] || null;
  }

  function defaultInstruction(type) {
    return {
      fill: 'Complete the notes below. Write ONE WORD AND/OR A NUMBER for each answer.',
      mcq: 'Choose the correct letter, A, B, C or D.',
      match: 'Choose the correct answer from the box, A\u2013E.'
    }[type] || '';
  }

  function normalizePoolEntries(pool) {
    if (!Array.isArray(pool)) return null;
    const out = [];
    const seen = new Set();
    pool.forEach((op, i) => {
      let label = '', text = '';
      if (typeof op === 'string') { label = String.fromCharCode(65 + i); text = op.trim(); }
      else if (op && typeof op === 'object') {
        label = String(op.label || String.fromCharCode(65 + i)).trim();
        text = String(op.text || '').trim();
      }
      if (!text) return;
      const k = label.toLowerCase();
      if (k && seen.has(k)) return;
      if (k) seen.add(k);
      out.push({ label, text });
    });
    return out.length >= 3 ? out : null;
  }

  /* ---------- SANITIZE — repair or drop every structurally
     invalid question/group BEFORE assembly ---------- */
  function sanitizeQuestion(q, type, pool) {
    if (type === 'fill') {
      const label = String(q.label || q.prompt || '').trim();
      if (!label) return null;
      let answer, accepts = Array.isArray(q.accepts) ? q.accepts.map(a => String(a).trim()).filter(Boolean) : [];
      if (Array.isArray(q.answer)) {
        const all = q.answer.map(a => String(a).trim()).filter(Boolean);
        if (!all.length) return null;
        answer = all[0];
        accepts = uniq(accepts.concat(all.slice(1)));
      } else {
        answer = String(q.answer == null ? '' : q.answer).trim();
      }
      if (!answer) return null;
      return { type: 'fill', label, label2: q.label2 ? String(q.label2) : null, inline: !!q.inline, answer, accepts };
    }
    if (type === 'mcq') {
      const prompt = String(q.prompt || '').trim();
      if (!prompt) return null;
      const opts = (Array.isArray(q.options) ? q.options : [])
        .map(o => {
          if (o && typeof o === 'object') return { label: String(o.label || '').trim(), text: String(o.text || '').trim() };
          if (typeof o === 'string') return { label: '', text: o.trim() };
          return null;
        })
        .filter(o => o && o.text);
      opts.forEach((o, i) => { if (!o.label) o.label = String.fromCharCode(65 + i); });
      if (opts.length < 3) return null;

      const ans = String(q.answer == null ? '' : q.answer).trim();
      let hit = opts.find(o => o.label.toLowerCase() === ans.toLowerCase());
      if (!hit) { const m = ans.match(/^([A-Da-d])\b/); hit = m && opts.find(o => o.label.toLowerCase() === m[1].toLowerCase()); }
      if (!hit) hit = opts.find(o => o.text.toLowerCase() === ans.toLowerCase());
      if (!hit) return null;
      return { type: 'mcq', prompt, options: opts, answer: hit.label };
    }
    if (type === 'match') {
      const prompt = String(q.prompt || q.label || '').trim();
      if (!prompt || !pool) return null;
      const ans = String(q.answer == null ? '' : q.answer).trim();
      const byLabel = pool.find(o => o.label.toLowerCase() === ans.toLowerCase());
      const byText = !byLabel && pool.find(o => o.text.toLowerCase() === ans.toLowerCase());
      const final = byLabel ? byLabel.label : (byText ? byText.label : null);
      if (!final) return null;
      return { type: 'match', prompt, answer: final };
    }
    return null;
  }

  function sanitizeSection(sec, secNo) {
    /* transcript: accept a single string; coerce to clean array */
    let tr = sec.transcript;
    if (typeof tr === 'string') tr = tr.split(/\n+/);
    sec.transcript = (Array.isArray(tr) ? tr : []).map(l => String(l == null ? '' : l).trim()).filter(Boolean);

    /* conversation flag: infer from "NAME:" prefixes if not boolean */
    if (typeof sec.conversation !== 'boolean') {
      sec.conversation = sec.transcript.some(l => /^[A-Z][A-Z0-9 _-]{1,24}:\s/.test(l));
    }
    if (!sec.num) sec.num = secNo;
    if (!sec.scenario || !String(sec.scenario).trim()) sec.scenario = 'Section ' + sec.num;

    const canonPool = {};   // first valid pool per type within this section
    const outGroups = [];

    (Array.isArray(sec.groups) ? sec.groups : []).forEach(g => {
      if (!g || typeof g !== 'object') return;
      const type = normalizeGroupType(g.type);
      if (!type) return;

      let pool = null;
      if (type === 'match') {
        pool = normalizePoolEntries(g.pool);
        if (pool && !canonPool.match) canonPool.match = pool;
      }

      const qs = [];
      (Array.isArray(g.questions) ? g.questions : []).forEach(q => {
        if (!q || typeof q !== 'object') return;
        const fixed = sanitizeQuestion(q, type, type === 'match' ? pool : null);
        if (fixed) qs.push(fixed);
      });
      if (!qs.length) return;

      const ng = {
        title: g.title || '',
        type,
        instruction: g.instruction || defaultInstruction(type),
        allow: g.allow || null,
        formTitle: type === 'fill' ? (g.formTitle || null) : null,
        notes: false,
        notesTitle: type === 'fill' ? (g.notesTitle || null) : null,
        questions: qs
      };
      if (type === 'fill') {
        /* guarantee a renderer: form style OR note lines */
        if (!ng.formTitle) ng.notes = true;
      }
      if (type === 'match') {
        if (!pool && canonPool.match) pool = canonPool.match;   // borrow
        if (!pool) return;                                       // unrenderable → drop group
        ng.pool = pool;
      }
      outGroups.push(ng);
    });

    sec.groups = outGroups;
  }

  /* ---------- one generation attempt for a single section ---------- */
  async function genSection(scenario, bp, planContext, continuity, feedback, signal) {
    const raw = await AI.request({
      system: GEN_SYSTEM,
      prompt: sectionPrompt(scenario, bp, planContext, continuity, feedback),
      temperature: 0.7,
      maxTokens: 6500,
      signal
    });
    const obj = AI.extractJSON(raw);
    if (!Array.isArray(obj.transcript) || !obj.transcript.length) {
      throw new Error(`AI returned no transcript for Section ${bp.part}.`);
    }

    /* fallback: questions at the top level instead of inside groups */
    if ((!Array.isArray(obj.groups) || !obj.groups.length) && Array.isArray(obj.questions) && obj.questions.length) {
      const byType = {};
      obj.questions.forEach(q => {
        const t = normalizeGroupType(q && q.type);
        if (!t) return;
        (byType[t] = byType[t] || []).push(q);
      });
      obj.groups = Object.keys(byType).map(t => ({ type: t, questions: byType[t] }));
    }

    obj.num = bp.part;
    obj.scenario = (typeof obj.scenario === 'string' && obj.scenario.trim()) ? obj.scenario.trim() : scenario;
    obj.context = obj.context || planContext;

    /* full structural repair before the section is accepted */
    sanitizeSection(obj, bp.part);
    return obj;
  }

  /* ---------- retry wrapper: structural failures only; a section
     with a valid transcript is always kept (top-up fills it).
     The real underlying error is surfaced for diagnosis. ---------- */
  async function genSectionWithRetry(scenario, bp, planContext, continuity, { onStep = () => {}, signal } = {}) {
    const MAX_ATTEMPTS = 3;
    let feedback = '';
    let last = null;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const sec = await genSection(scenario, bp, planContext, continuity, feedback, signal);
        last = sec;

        if (totalQuestions(sec) === 0) {
          lastError = new Error('no structurally valid questions in the response');
          feedback = 'Your previous response contained no structurally valid questions (wrong shapes, missing pools or options). ' +
                     'Return the complete JSON object exactly in the requested schema.';
          onStep(bp.part - 1, 'active', `retry ${attempt} — repairing questions`);
          continue;
        }
        if (totalQuestions(sec) !== bp.count) {
          console.warn(`[ListeningGen] Section ${bp.part}: AI returned ${totalQuestions(sec)} questions ` +
                       `(target ${bp.count}) — accepted; assembly will balance to 10.`);
        }
        return sec;

      } catch (e) {
        lastError = e;
        feedback = 'Your previous response was rejected because: ' + (e.message || 'invalid output') +
                   ' Return the complete, valid JSON object now.';
        onStep(bp.part - 1, 'active', `retry ${attempt} — fixing output`);
      }
    }

    if (last && last.transcript && last.transcript.length) {
      console.warn(`[ListeningGen] Section ${bp.part}: keeping transcript with ${totalQuestions(last)} valid questions ` +
                   `after ${MAX_ATTEMPTS} attempts — assembly top-up will fill the rest.`);
      return last;
    }

    const detail = lastError ? ` Last error: ${String(lastError.message || lastError).slice(0, 300)}` : '';
    throw new Error(`Section ${bp.part} could not be generated after ${MAX_ATTEMPTS} attempts.${detail} ` +
                    `Please generate again (or switch model in Settings), or use the built-in test.`);
  }

  /* ---------- safe per-section trim to exactly 10 ---------- */
  const TRIM_RANK = { fill: 0, mcq: 1, match: 2 };
  function trimSectionTo(sec, target) {
    let excess = totalQuestions(sec) - target;
    if (excess <= 0) return true;
    for (let rank = 0; rank <= 2 && excess > 0; rank++) {
      for (let gi = sec.groups.length - 1; gi >= 0 && excess > 0; gi--) {
        const g = sec.groups[gi];
        for (let qi = g.questions.length - 1; qi >= 0 && excess > 0; qi--) {
          if ((TRIM_RANK[g.questions[qi].type] != null ? TRIM_RANK[g.questions[qi].type] : 2) === rank) {
            g.questions.splice(qi, 1);
            excess--;
          }
        }
      }
    }
    sec.groups = sec.groups.filter(g => g.questions.length > 0);
    return excess === 0;
  }

  /* ---------- targeted AI fill top-up (verbatim-verified) ---------- */
  function appearsInTranscript(answer, hay) {
    const a = String(answer || '').toLowerCase().trim();
    if (!a) return false;
    const escRe = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(^|[^a-z0-9])' + escRe + '($|[^a-z0-9])').test(hay);
  }

  async function topUpFillChunk(sec, need, signal) {
    const hay = sec.transcript.join(' ').toLowerCase();
    const existingLabels = new Set();
    const usedAnswers = new Set();
    sec.groups.forEach(g => g.questions.forEach(q => {
      if (q.type === 'fill') {
        existingLabels.add(String(q.label || '').toLowerCase().trim());
        usedAnswers.add(String(q.answer || '').toLowerCase().trim());
        (q.accepts || []).forEach(a => usedAnswers.add(String(a).toLowerCase().trim()));
      }
    }));

    const prompt = `You are extending an existing IELTS Listening section.

TRANSCRIPT (Section ${sec.num} — "${sec.scenario}"):
 ${sec.transcript.join('\n').slice(0, 9000)}

 ${existingLabels.size ? `EXISTING question labels (do NOT repeat or paraphrase any of them):\n${Array.from(existingLabels).map(l => '- ' + l).join('\n')}\n` : ''}${usedAnswers.size ? `ANSWERS already used (do NOT reuse): ${Array.from(usedAnswers).join(', ')}\n` : ''}
Write EXACTLY ${need} NEW completion questions about this transcript.

RULES:
1. Each question: {"label": "a short note or sentence fragment containing the missing information", "answer": "the missing word"}
2. The "answer" MUST appear VERBATIM in the transcript — copy it EXACTLY as written there (same spelling, same form). Prefer single words; never use digits unless the transcript itself uses digits.
3. Test different facts from different parts of the transcript.

Respond with ONLY one JSON object, exactly in this shape:
{"questions": [{"label": "...", "answer": "..."}${need > 1 ? `, ... ${need} items total` : ''}]}`;

    const raw = await AI.request({ system: GEN_SYSTEM, prompt, temperature: 0.5, maxTokens: 1000, signal });
    const obj = AI.extractJSON(raw);
    const arr = Array.isArray(obj && obj.questions) ? obj.questions : [];

    const out = [];
    for (const q of arr) {
      if (out.length >= need) break;
      if (!q || typeof q !== 'object') continue;
      const label = String(q.label || '').trim();
      const answer = String(q.answer || '').trim();
      if (!label || !answer) continue;
      if (existingLabels.has(label.toLowerCase())) continue;
      if (usedAnswers.has(answer.toLowerCase())) continue;
      if (!appearsInTranscript(answer, hay)) continue;   // verbatim verification
      out.push({ type: 'fill', label, label2: null, inline: false, answer, accepts: [] });
      existingLabels.add(label.toLowerCase());
      usedAnswers.add(answer.toLowerCase());
    }
    return out;
  }

  function pushTopUps(sec, added) {
    let g = null;
    for (let i = sec.groups.length - 1; i >= 0; i--) {
      if (sec.groups[i].type === 'fill') { g = sec.groups[i]; break; }
    }
    if (!g) {
      g = {
        title: '', type: 'fill',
        instruction: 'Complete the sentences below. Write ONE WORD AND/OR A NUMBER for each answer.',
        allow: 'ONE WORD AND/OR A NUMBER',
        formTitle: null, notes: true, notesTitle: null,
        questions: []
      };
      sec.groups.push(g);
    }
    g.questions.push(...added);
  }

  /* ---------- full test: 4 sections → force 10 each → 40 ---------- */
  async function gen(dayPlan, { onStep = () => {}, signal } = {}) {
    const scenarios = dayPlan.listening.sections;   // [{num, context, scenario}]
    const parts = [];
    for (let i = 0; i < 4; i++) {
      onStep(i, 'active');
      try {
        const continuity = i === 0 ? '' :
          `Continuity: this is Section ${i + 1} of ONE test for the same candidate \u2014 keep a consistent difficulty rise, but make this section fully self-contained.`;
        parts.push(await genSectionWithRetry(scenarios[i].scenario, BLUEPRINTS[i], scenarios[i].context, continuity, { onStep, signal }));
        onStep(i, 'done');
      } catch (e) {
        onStep(i, 'error');
        throw e;
      }
    }

    /* ---- ASSEMBLY: guarantee exactly 10 per section (40 total) ---- */
    onStep(4, 'active');
    for (const sec of parts) {
      let t = totalQuestions(sec);
      if (t > 10) {
        trimSectionTo(sec, 10);
        console.warn(`[ListeningGen] Section ${sec.num}: assembly trim ${t} → ${totalQuestions(sec)} questions.`);
        t = totalQuestions(sec);
      }
      if (t < 10) {
        let need = 10 - t;
        let guard = 0;
        while (need > 0 && guard < 5) {
          guard++;
          const chunk = Math.min(need, 5);
          onStep(4, 'active', `top-up +${chunk} (Section ${sec.num})`);
          let added = [];
          try { added = await topUpFillChunk(sec, chunk, signal); }
          catch (e) { console.warn('[ListeningGen] top-up attempt failed:', e.message); }
          if (!added.length) break;
          pushTopUps(sec, added);
          need -= added.length;
        }
        if (need > 0) {
          onStep(4, 'error');
          throw new Error(`Section ${sec.num} reached ${totalQuestions(sec)} of 10 questions and the top-up did not complete. Please generate again, or use the built-in test.`);
        }
        console.warn(`[ListeningGen] Section ${sec.num}: assembly top-up → ${totalQuestions(sec)} questions.`);
      }
    }

    const test = buildTest(parts, 'ai');
    const v = validateTest(test);
    if (!v.ok) { onStep(4, 'error'); throw new Error('Generated test failed validation: ' + v.errors[0]); }
    onStep(4, 'done');
    return test;
  }

  return { builtin, gen, buildTest, validateTest, wc };
})();
