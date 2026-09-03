// Generates: mock test pages (client-side engine) + /mock-test/ listing — Schema V2
// Tests reference question bank IDs (एक question → अनेक tests, zero duplication)
import { loadSite, loadCategories, loadTests, loadQuestionBank, write, esc, pageHtml, pathOf } from '../lib.mjs';

const site = loadSite();
const categories = loadCategories();
const tests = loadTests();
// Question bank lookup (bank files: data/questions/<exam>.json)
const bankByExam = {};
for (const bank of loadQuestionBank()) {
  bankByExam[bank.exam] = bank.questions || [];
}
const qById = new Map();
for (const q of Object.values(bankByExam).flat()) if (q && q.id) qById.set(q.id, q);

function resolveQuestions(t) {
  // Reference-only; test मध्ये full question object NEVER copy करायचा
  const resolved = (t.questionIds || []).map(id => qById.get(id)).filter(Boolean);
  return resolved.filter(q => q.question && q.correctAnswer && q.explanation); // explanation आवश्यक
}

let count = 0;
for (const t of tests) {
  if (!t.questionIds || !t.questionIds.length) { console.error(`  [SKIP] ${t.id}: no questionIds`); continue; }
  const resolved = resolveQuestions(t);
  if (!resolved.length) { console.error(`  [SKIP] ${t.id}: no resolvable valid questions`); continue; }

  const data = {
    title: t.titleMr || t.title,
    durationMinutes: t.durationMinutes || 10,
    questions: resolved.map(q => ({
      qid: q.id,
      question: q.question,
      options: q.options, // structured options[] array
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      subject: q.subject || '',
      source: q.source || null,
      topic: q.topic || null
    }))
  };

  const body = `
<div class="breadcrumb"><a href="/">Home</a> › <a href="/mock-test/">Mock Test</a></div>
<div class="page-header"><h1>${esc(t.titleMr || t.title)}</h1></div>
<div class="highlight"><strong>${resolved.length} प्रश्न</strong> · वेळ: ${t.durationMinutes} मिनिटे · प्रत्येक प्रश्नाला उत्तर निवडा आणि शेवटी <em>सबमिट</em> करा.</div>
<div id="result" class="result-summary" style="display:none"></div>
<div id="quiz"></div>
<div class="quiz-bar">
  <span class="timer" id="timer">⏱ --:--</span>
  <div class="quiz-btns">
    <button class="btn-secondary" id="btn-prev">‹ मागील</button>
    <button class="btn-secondary" id="btn-next">पुढील ›</button>
    <button class="btn-primary" id="btn-submit">सबमिट करा</button>
  </div>
</div>`;

  const page = pageHtml(site, categories, {
    title: `${t.titleMr || t.title} — Free Mock Test`,
    description: `${t.titleMr || t.title} — ${resolved.length} प्रश्नांचा फ्री ऑनलाइन मॉक टेस्ट, स्पष्टीकरणासह.`,
    canonical: site.url + pathOf(t),
    body,
    ogImage: null
  }).replace('</head>', `<script>window.TEST_DATA=${JSON.stringify(data)};</script>\n<script src="/assets/js/mock-engine.js" defer></script>\n</head>`);

  write(pathOf(t).replace(/^\//, '') + 'index.html', page);
  count++;
  console.log(`  mock test: ${pathOf(t)} (${resolved.length} questions)`);
}

// Listing page
if (tests.length) {
  const body = `
<div class="page-header"><h1>मॉक टेस्ट</h1></div>
<p>फ्री ऑनलाइन मॉक टेस्ट — timer, स्पष्टीकरण आणि score analysis सह.</p>
<div class="post-list">
${tests.map(t => `<a class="post-card" href="${esc(pathOf(t))}"><div><span class="badge-cat">${esc(t.exam)}</span></div><div class="title">${esc(t.titleMr || t.title)}</div><div class="meta">${(t.questionIds || []).length} प्रश्न · ${t.durationMinutes} मिनिटे</div></a>`).join('\n')}
</div>`;
  write('mock-test/index.html', pageHtml(site, categories, { title: 'मॉक टेस्ट — Free Online Mock Tests', description: 'स्पर्धा परीक्षेसाठी फ्री ऑनलाइन मॉक टेस्ट.', canonical: site.url + '/mock-test/', body }));
  console.log('  listing: /mock-test/');
}
console.log(`mock-test.mjs: ${count} test pages generated`);
