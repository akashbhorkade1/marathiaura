// Generates: exam hub pages (complete exam ecosystem — hub, duplicate content नाही)
// Schema V2: only render relationship links when the referenced record/page actually exists.
import { loadSite, loadCategories, loadExams, loadPosts, loadTests, published, write, esc, pageHtml, pathOf } from '../lib.mjs';

const site = loadSite();
const categories = loadCategories();
const exams = published(loadExams());
const posts = published(loadPosts());
const tests = loadTests();
const catById = Object.fromEntries(categories.map(c => [c.id, c]));
const testByExam = {};
for (const t of tests) { (testByExam[t.exam] = testByExam[t.exam] || []).push(t); }
let count = 0;

for (const e of exams) {
  const cat = catById[e.category];
  const stages = (e.pattern.stages || []).map(s => `<li>${esc(s)}</li>`).join('');
  const papers = (e.pattern.papers || []).map(p =>
    `<tr><td>${esc(p.name)}</td><td>${p.questions ?? '—'}</td><td>${p.marks ?? '—'}</td><td>${esc(p.duration || '—')}</td><td>${esc(p.negativeMarking || '—')}</td></tr>`).join('');

  // Hub relationships — फक्त record अस्तित्वात असेल तरच link दाखवा (no fake links)
  const rel = [];
  if (e.syllabusRef && posts.some(p => p.type === 'syllabus' && p.path === e.syllabusRef)) {
    rel.push(`<a href="${esc(e.syllabusRef)}">अभ्यासक्रम (Syllabus)</a>`);
  }
  const examNameMatch = (e.examNameMr || '').toLowerCase();
  const relatedRec = posts.filter(p => p.type === 'recruitment' && p.exam === e.id);
  for (const r of relatedRec) rel.push(`<a href="${esc(pathOf(r))}">${esc(r.title.split(':')[0])}</a>`);
  const examTests = testByExam[e.id] || [];
  for (const t of examTests) rel.push(`<a href="${esc(pathOf(t))}">मॉक टेस्ट: ${esc(t.titleMr || t.title)}</a>`);
  for (const p of posts) {
    if (p.category === 'answer-key') rel.push(`<a href="${esc(pathOf(p))}">उत्तरतालिका</a>`);
    if (p.category === 'result') rel.push(`<a href="${esc(pathOf(p))}">निकाल</a>`);
    if (p.category === 'admit-card') rel.push(`<a href="${esc(pathOf(p))}">प्रवेशपत्र</a>`);
    if (p.category === 'previous-papers') rel.push(`<a href="${esc(pathOf(p))}">जुन्या प्रश्नपत्रिका</a>`);
  }
  const relLink = rel.filter((v, i, a) => a.indexOf(v) === i);
  const relHtml = relLink.length ? `<div class="content-section"><h2>संबंधित माहिती (Exam Hub)</h2><p>${relLink.join(' · ')}</p></div>` : '';

  const body = `
<div class="breadcrumb"><a href="/">Home</a> › <a href="${esc(cat ? cat.path : '/')}">${esc(cat ? cat.nameMr : '')}</a></div>
<div class="page-header"><h1>${esc(e.examNameMr)}</h1></div>
<div class="last-updated">अखेरचे अद्ययावत: ${esc((e.lastUpdatedAt || '').slice(0, 10))}</div>
<div class="highlight"><strong>${esc(e.examName)}</strong> — ${esc(e.conductingBody)}. ${e.description ? esc(e.description) : ''}</div>

<div class="content-section"><h2>पात्रता व वयोमर्यादा</h2>
<table><tbody>
<tr><th>शैक्षणिक पात्रता</th><td>${esc(e.eligibility.education)}</td></tr>
<tr><th>वयोमर्यादा</th><td>${e.eligibility.ageLimit.min} – ${e.eligibility.ageLimit.max} वर्षे ${e.eligibility.ageLimit.note ? '(' + esc(e.eligibility.ageLimit.note) + ')' : ''}</td></tr>
<tr><th>अधिकृत संकेतस्थळ</th><td><a href="${esc(e.officialUrl)}" target="_blank" rel="noopener">${esc(e.officialUrl)}</a></td></tr>
</tbody></table></div>

<div class="content-section"><h2>निवड प्रक्रिया</h2><ol>${stages}</ol></div>

<div class="content-section"><h2>Exam Pattern</h2>
<table><thead><tr><th>पेपर</th><th>प्रश्न</th><th>गुण</th><th>वेळ</th><th>Negative Marking</th></tr></thead>
<tbody>${papers}</tbody></table></div>

${relHtml}

<div class="source-row"><span>स्रोत: <a href="${esc(e.officialUrl)}" target="_blank" rel="noopener">${esc(e.officialUrl)}</a></span>
<span>⚠ अंतिम व अचूक माहितीसाठी अधिकृत जाहिरात/अभ्यासक्रम तपासा.</span></div>`;

  write(pathOf(e).replace(/^\//, '') + 'index.html',
    pageHtml(site, categories, { title: `${e.examNameMr}: पात्रता, Syllabus, Exam Pattern`, description: `${e.examNameMr} — पात्रता, वयोमर्यादा, exam pattern आणि अभ्यासक्रम मराठीत.`, canonical: site.url + pathOf(e), body }));
  count++;
  console.log(`  exam hub: ${pathOf(e)} (${relLink.length} relation links)`);
}
console.log(`exam-hubs.mjs: ${count} pages generated`);
