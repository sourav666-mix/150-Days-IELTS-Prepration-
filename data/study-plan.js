/* ============================================================
   IELTS PRO 150 — 150-Day Study Plan Generator
   Deterministic: every day gets a unique topic combination.
   ============================================================ */

'use strict';

const StudyPlan = (() => {

  const TOTAL_DAYS = CONFIG.TOTAL_DAYS;

  const PHASES = [
    { id: 'foundation',  name: 'Foundation',  from: 1,   to: 50,  focus: 'Core skills, vocabulary and exam strategies' },
    { id: 'development', name: 'Development', from: 51,  to: 110, focus: 'Full timed sections with AI feedback loops' },
    { id: 'mastery',     name: 'Mastery',     from: 111, to: 150, focus: 'Full simulations — precision training for Band 8+' }
  ];

  /* ---------- Reading topics (50 — cycles 3× across 150 days) ---------- */
  const READING_TOPICS = [
    'The Origins of Written Language', 'Coral Bleaching and Ocean Warming', 'The Science of Sleep Cycles',
    'Urban Green Spaces and Public Health', 'The Silk Road: Trade and Ideas', 'Bird Migration and Navigation',
    'The Printing Revolution', 'Renewable Energy in Developing Nations', 'Bee Cognition and Agriculture',
    'Antarctic Ice Core Research', 'Music Training and Child Development', 'The Economics of Happiness',
    'Volcanic Ash and Aviation', 'Deep-Sea Hydrothermal Vents', 'Ancient Egyptian Engineering',
    'The Rise of Remote Work', 'Microplastics in Food Chains', 'The History of the Tea Trade',
    'Artificial Intelligence in Medicine', 'Seed Banks and Food Security', 'The Psychology of Decision Making',
    'Gaudí and Organic Architecture', 'Mangrove Forests as Coastal Shields', 'The Smallpox Vaccine Story',
    'Space Junk and Orbital Debris', 'Bilingualism and the Brain', 'The Green Revolution in Agriculture',
    'Photography and Historical Memory', 'Desertification and Land Management', 'The Story of the Suez Canal',
    'Animal Tool Use', 'Noise Pollution in Modern Cities', 'The Viking Expansion', 'Quantum Computing Basics',
    'Urban Heat Islands', 'The Revival of Indigenous Languages', 'The Circadian Rhythms of Plants',
    'Underwater Archaeology', 'The Global Supply Chain', 'Fair-Trade Certification',
    'The Science of Hearing Loss', 'Ancient Mayan Astronomy', 'Vertical Farming',
    'Preserving Historical Manuscripts', 'Insect Population Decline', 'The Physics of Bridges',
    'Ocean Tidal Energy', 'The History of Coffee Houses', 'Regenerative Medicine and Stem Cells',
    'Ethical Tourism and Local Communities'
  ];

  /* ---------- Writing Task 1 (type × dataset title) ---------- */
  const T1_SET = [
    { type: 'Line Graph',      title: 'Energy consumption in the UK, 1970–2020' },
    { type: 'Bar Chart',       title: 'Household spending across five countries, 2020' },
    { type: 'Pie Chart',       title: 'Water usage by sector, 2004 vs 2024' },
    { type: 'Table',           title: 'International student enrolment in Australia by field, 2010–2020' },
    { type: 'Line Graph',      title: 'International tourist arrivals in two island nations, 1995–2015' },
    { type: 'Bar Chart',       title: 'Recycling rates in four cities, 2000–2020' },
    { type: 'Process Diagram', title: 'The production of cement and concrete' },
    { type: 'Map Comparison',  title: 'Changes in a city centre between 1980 and the present day' },
    { type: 'Table',           title: 'Commuting methods in one European capital, 1990 vs 2020' },
    { type: 'Line Graph',      title: 'Meat consumption per person in three regions, 1985–2025' },
    { type: 'Pie Chart',       title: 'Household expenditure in one country in 1975 and 2015' },
    { type: 'Process Diagram', title: 'How sugar is produced from sugar cane' },
    { type: 'Bar Chart',       title: 'Population growth in three urban areas, 1950–2030 (projected)' },
    { type: 'Map Comparison',  title: 'Redevelopment plans for a harbour area' }
  ];

  /* ---------- Writing Task 2 (30 prompts — cycles 5× across 150 days) ---------- */
  const T2_SET = [
    { type: 'Opinion',           theme: 'Education',  prompt: 'Some people believe that university education should be free for all students, funded by the government. To what extent do you agree or disagree?' },
    { type: 'Discussion',        theme: 'Education',  prompt: 'Some people think students should study subjects they enjoy, while others believe they should choose subjects that are useful for their future career. Discuss both views and give your own opinion.' },
    { type: 'Adv/Disadv',        theme: 'Education',  prompt: 'In many countries, students take a gap year between school and university. What are the advantages and disadvantages of this?' },
    { type: 'Problem/Solution',  theme: 'Education',  prompt: 'In many schools, students behave badly and show disrespect to their teachers. What are the causes of this problem, and how can it be solved?' },
    { type: 'Two-part',          theme: 'Education',  prompt: 'Online learning is becoming increasingly popular. Why is this happening, and is it a positive or negative development?' },
    { type: 'Opinion',           theme: 'Technology', prompt: 'Some people believe that modern technology has made our lives more complicated rather than simpler. To what extent do you agree or disagree?' },
    { type: 'Discussion',        theme: 'Technology', prompt: 'Some people think governments should regulate social media companies, while others believe users should be free to decide what they see. Discuss both views and give your opinion.' },
    { type: 'Adv/Disadv',        theme: 'Technology', prompt: 'More and more people are working from home using computers and the internet. What are the advantages and disadvantages of this development?' },
    { type: 'Two-part',          theme: 'Technology', prompt: 'Artificial intelligence is being used to make important decisions in areas such as healthcare and recruitment. What problems can this cause, and how can they be avoided?' },
    { type: 'Opinion',           theme: 'Environment', prompt: 'Some people argue that the best way to solve environmental problems is to raise the cost of fuel. To what extent do you agree or disagree?' },
    { type: 'Discussion',        theme: 'Environment', prompt: 'Some people think individuals are responsible for protecting the environment, while others believe it is the job of governments. Discuss both views and give your own opinion.' },
    { type: 'Problem/Solution',  theme: 'Environment', prompt: 'The amount of household waste is increasing in many cities. What are the causes of this, and what measures could be taken to reduce it?' },
    { type: 'Two-part',          theme: 'Environment', prompt: 'Many species of animals are becoming extinct. Why is this happening, and what can be done to prevent it?' },
    { type: 'Opinion',           theme: 'Health',     prompt: 'Some people believe healthcare should be free for everyone, while others think individuals should pay for their own treatment. To what extent do you agree?' },
    { type: 'Discussion',        theme: 'Health',     prompt: 'Some people think the best way to improve public health is to build more sports facilities, while others say this has little effect and other measures are needed. Discuss both views.' },
    { type: 'Adv/Disadv',        theme: 'Health',     prompt: 'In many countries, people are choosing to buy ready-made meals instead of cooking fresh food. Do the advantages of this outweigh the disadvantages?' },
    { type: 'Two-part',          theme: 'Health',     prompt: 'Mental health problems are rising among young people. What are the main causes, and what can schools and parents do to help?' },
    { type: 'Opinion',           theme: 'Work',       prompt: 'Some people believe it is better to work for one company for a whole career, while others think changing jobs regularly is more beneficial. To what extent do you agree or disagree?' },
    { type: 'Discussion',        theme: 'Work',       prompt: 'Some people think a high salary is the most important factor when choosing a job, while others believe job satisfaction matters more. Discuss both views and give your opinion.' },
    { type: 'Adv/Disadv',        theme: 'Work',       prompt: 'In some countries, teenagers are encouraged to take part-time jobs while studying. Do the advantages of this outweigh the disadvantages?' },
    { type: 'Two-part',          theme: 'Work',       prompt: 'Many employees now expect flexible working hours. Why has this attitude changed, and what effects has it had on businesses?' },
    { type: 'Opinion',           theme: 'Society',    prompt: 'Some people think that in the modern world we are more dependent on each other, while others argue we have become more independent. To what extent do you agree?' },
    { type: 'Discussion',        theme: 'Society',    prompt: 'Some believe elderly people should live in specialist care homes, while others think they are better cared for by their families. Discuss both views and give your opinion.' },
    { type: 'Problem/Solution',  theme: 'Society',    prompt: 'In many cities, the gap between rich and poor is widening. What problems does this cause, and what solutions can you suggest?' },
    { type: 'Opinion',           theme: 'Crime',      prompt: 'Some people claim that the best way to reduce crime is to give longer prison sentences. To what extent do you agree or disagree?' },
    { type: 'Discussion',        theme: 'Media',      prompt: 'Some people think newspapers are the best source of news, while others believe the internet is better. Discuss both views and give your own opinion.' },
    { type: 'Adv/Disadv',        theme: 'Culture',    prompt: 'International travel is becoming cheaper, and more countries are opening their doors to tourists. Do the advantages of this outweigh the disadvantages?' },
    { type: 'Two-part',          theme: 'Culture',    prompt: 'Many traditional customs are disappearing around the world. Why is this happening, and should anything be done to preserve them?' },
    { type: 'Opinion',           theme: 'Transport',  prompt: 'Some people believe that building more roads is the best way to reduce traffic congestion in cities. To what extent do you agree or disagree?' },
    { type: 'Problem/Solution',  theme: 'Cities',     prompt: 'Traffic jams and air pollution are major problems in many big cities. What are the main causes, and what steps can governments take to tackle them?' }
  ];

  /* ---------- Listening scenarios (4 × 12) ---------- */
  const L1 = [
    { title: 'Hotel booking for a wedding party' }, { title: 'Part-time job enquiry at a bookshop' },
    { title: 'Gym membership registration' },       { title: 'Library card application call' },
    { title: 'Evening course enrolment' },          { title: 'Furniture rental agreement' },
    { title: 'Airport transfer booking' },          { title: 'Community sports club sign-up' },
    { title: 'Home internet plan enquiry' },        { title: 'Homestay arrangement for a student' },
    { title: 'Bicycle repair shop order' },         { title: 'Theatre season ticket booking' }
  ];
  const L2 = [
    { title: 'Radio tour of a covered market' },      { title: 'Museum new-wing guided tour' },
    { title: 'City park facilities announcement' },   { title: 'New employee induction talk' },
    { title: 'Charity walk route briefing' },         { title: 'Open day at a model farm' },
    { title: 'Summer festival schedule' },            { title: 'University library orientation' },
    { title: 'Harbour renovation announcement' },     { title: 'Historic district walking tour' },
    { title: 'New community centre opening' },        { title: 'Wildlife sanctuary visitor rules' }
  ];
  const L3 = [
    { title: 'Tutor and two students: research assignment' }, { title: 'Group project on green marketing' },
    { title: 'Feedback on a class presentation' },            { title: 'Planning a field trip to a volcano site' },
    { title: 'Choosing a dissertation topic' },               { title: 'Discussing a lab report draft' },
    { title: 'Preparing a seminar on urban design' },         { title: 'Peer review of essays' },
    { title: 'Internship experience discussion' },            { title: 'Struggles with a statistics course' },
    { title: 'Survey methodology project' },                  { title: 'Architecture studio critique' }
  ];
  const L4 = [
    { title: 'Marine biology: life at hydrothermal vents' }, { title: 'History of urban planning' },
    { title: 'Corporate sponsorship in sport' },             { title: 'The science of sleep research' },
    { title: 'A short history of renewable energy' },        { title: 'Bird song and communication' },
    { title: 'Archaeology of ancient shipwrecks' },          { title: 'Psychology of consumer behaviour' },
    { title: 'How glaciers move and shape land' },           { title: 'The development of writing systems' },
    { title: 'Agricultural robotics' },                      { title: 'Urban wildlife ecology' }
  ];

  /* ---------- API ---------- */
  function getPhase(day) {
    return PHASES.find(p => day >= p.from && day <= p.to) || PHASES[PHASES.length - 1];
  }

  function getDayPlan(day) {
    const d = clamp(day, 1, TOTAL_DAYS);
    const i = d - 1;
    const t1 = T1_SET[i % T1_SET.length];
    const t2 = T2_SET[i % T2_SET.length];

    return {
      day: d,
      phase: getPhase(d),
      isMock: d % 15 === 0,   // every 15th day = full mock day

      reading: {
        minutes: 60, passages: 3, questions: 40, words: '2,150–2,750',
        topic: READING_TOPICS[i % READING_TOPICS.length]
      },

      writing: {
        minutes: 60,
        task1: { type: t1.type, title: t1.title, minWords: CONFIG.WRITING.TASK1_MIN_WORDS, suggestedMinutes: CONFIG.WRITING.TASK1_SUGGESTED_MINUTES },
        task2: { type: t2.type, theme: t2.theme, prompt: t2.prompt, minWords: CONFIG.WRITING.TASK2_MIN_WORDS, suggestedMinutes: CONFIG.WRITING.TASK2_SUGGESTED_MINUTES }
      },

      listening: {
        minutes: 30, questions: 40,
        sections: CONFIG.LISTENING.SECTION_META.map(m => ({
          num: m.num, context: m.context, desc: m.desc,
          scenario: [L1, L2, L3, L4][m.num - 1][i % 12].title
        }))
      }
    };
  }

  return { TOTAL_DAYS, PHASES, getPhase, getDayPlan };
})();