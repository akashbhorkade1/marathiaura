// Generates: exam hub pages (complete exam ecosystem)
import { loadSite, loadCategories, loadExams, published, write, esc, pageHtml, pathOf } from '../lib.mjs';

const site = loadSite();
const categories = loadCategories();
const exams = published(loadExams());
const catById = Object.fromEntries(categories.map(c => [c.id, c]));
let count = 0;

for (const e of exams) {
  const cat = catById[e.category];
  const stages = (e.pattern.stages || []).map(s => `<li>${esc(s)}</li>`).join('');
  const papers = (e.pattern.papers || []).map(p =>
    `<tr><td>${esc(p.name)}</td><td>${p.questions ?? '—'}</td><td>${p.marks ?? '—'}</td><td>${esc(p.duration || '—')}</td><td>${esc(p.negativeMarking || '—')}</td></tr>`).join('');
  const subjects = (e.syllabus.subjects || []).map(s =>
    `<div class="content-section"><h2>${esc(s.subject)}</h2><ul>${(s.topics || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('');

  const body = `
<div class="breadcrumb"><a href="/">Home</a> › <a href="${esc(cat ? cat.path : '/')}">${esc(cat ? cat.nameMr : '')}</a></div>
<div class="page-header"><h1>${esc(e.examNameMr)}</h1></div>
<div class="last-updated">अखेरचे अद्ययावत: ${esc((e.lastUpdatedAt || '').slice(0, 10))}</div>
<div class="highlight"><strong>${esc(e.examName)}</strong> — ${esc(e.conductingBody)}. येथे पात्रता, exam pattern, अभ्यासक्रम आणि संबंधित सर्व दुवे एकाच ठिकाणी.</div>

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

${subjects}

<div class="source-row"><span>स्रोत: <a href="${esc(e.officialUrl)}" target="_blank" rel="noopener">${esc(e.officialUrl)}</a></span>
<span>⚠ अंतिम व अचूक माहितीसाठी अधिकृत जाहिरात/अभ्यासक्रम तपासा.</span></div>`;

  write(pathOf(e).replace(/^\//, '') + 'index.html',
    pageHtml(site, categories, { title: `${e.examNameMr}: पात्रता, Syllabus, Exam Pattern`, description: `${e.examNameMr} — पात्रता, वयोमर्यादा, exam pattern आणि अभ्यासक्रम मराठीत.`, canonical: site.url + pathOf(e), body }));
  count++;
  console.log(`  exam hub: ${pathOf(e)}`);
}
console.log(`exam-hubs.mjs: ${count} pages generated`);
