// Generates: syllabus pages (type: syllabus) + /syllabus/ hub index — Schema V2 compliant
import { loadSite, loadCategories, loadPosts, loadExams, published, write, esc, pageHtml, pathOf, svgOg } from '../lib.mjs';

const site = loadSite();
const categories = loadCategories();
const posts = published(loadPosts());
const exams = published(loadExams());
const examById = Object.fromEntries(exams.map(e => [e.id, e]));
const syllabi = posts.filter(p => p.type === 'syllabus');
const catById = Object.fromEntries(categories.map(c => [c.id, c]));
let count = 0;

function patternTable(s) {
  const papers = (s.examPattern.papers || []).map(p =>
    `<tr><td>${esc(p.name)}</td><td>${p.questions ?? '—'}</td><td>${p.marks ?? '—'}</td><td>${esc(p.duration || '—')}</td><td>${esc(p.negativeMarking || '—')}</td></tr>`).join('');
  return `<div class="content-section"><h2>Exam Pattern</h2>
  <p><strong>निवड टप्पे:</strong> ${(s.examPattern.stages || []).map(esc).join(' → ')}</p>
  <table><thead><tr><th>पेपर</th><th>प्रश्न</th><th>गुण</th><th>वेळ</th><th>Negative Marking</th></tr></thead>
  <tbody>${papers}</tbody></table></div>\n`;
}

function subjectSections(s) {
  return (s.subjects || []).map(sub => `<div class="content-section"><h2>${esc(sub.subject)}</h2>${
    (sub.topics || []).map(t => {
      const points = Array.isArray(t) ? t : (t.points || []);
      return `<h3 style="font-size:1rem;margin:10px 0 4px">${esc(Array.isArray(t) ? t[0] : t.topic)}</h3><ul>${points.map(pt => `<li>${esc(pt)}</li>`).join('')}</ul>`;
    }).join('')
  }</div>\n`).join('');
}

function renderSyllabus(p) {
  const cat = catById[p.category];
  const exam = p.exam ? examById[p.exam] : null;
  const s = p.syllabus || {};

  const related = [];
  const recPost = posts.find(x => x.type === 'recruitment' && x.syllabusRef === p.path);
  if (recPost) related.push(`<a href="${pathOf(recPost)}">${esc(recPost.title.split(':')[0])} — भरती तपशील</a>`);
  if (exam) related.push(`<a href="${pathOf(exam)}">${esc(exam.examNameMr)} — Exam Hub</a>`);
  (p.relatedMockTests || []).forEach(t => related.push(`<a href="/mock-test/${esc(t)}/">मॉक टेस्ट</a>`));
  const relatedHtml = related.length ? `<div class="content-section"><h2>संबंधित माहिती</h2><p>${related.join(' · ')}</p></div>` : '';

  const faqs = (p.content.faqs || []);
  const faqHtml = faqs.length ? `<div class="content-section"><h2>वारंवार विचारले जाणारे प्रश्न</h2>${
    faqs.map(f => `<div class="faq-item"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join('')
  }</div>` : '';

  const body = `
<div class="breadcrumb"><a href="/">Home</a> › <a href="${esc(cat ? cat.path : '/')}">${esc(cat ? cat.nameMr : '')}</a></div>
<div class="page-header"><h1>${esc(p.title)}</h1></div>
<div class="last-updated">अखेरचे अद्ययावत: ${esc((p.lastUpdatedAt || '').slice(0, 10))}</div>
<div class="highlight"><strong>थोडक्यात:</strong> ${esc(p.content.shortDesc)}</div>
${s.examPattern ? patternTable(s) : ''}
${subjectSections(s)}
${s.preparationTips ? `<div class="content-section"><h2>तयारीचे टिप्स</h2><ul>${s.preparationTips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
${s.officialSyllabusUrl ? `<div class="download-card"><div class="dl-info"><div class="dl-title">अधिकृत अभ्यासक्रम</div></div><a href="${esc(s.officialSyllabusUrl)}" target="_blank" rel="noopener">PDF पहा</a></div>` : ''}
${s.note ? `<div class="highlight">ℹ ${esc(s.note)}</div>` : ''}
${faqHtml}
${relatedHtml}
<div class="source-row">
  <span>स्रोत: ${(p.sources || []).filter(x => x.url).map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>`).join(', ') || 'अधिकृत स्रोत'}</span>
  <span>⚠ अंतिम व अचूक अभ्यासक्रमासाठी अधिकृत जाहिरात तपासा.</span>
</div>`;

  write(pathOf(p).replace(/^\//, '') + 'index.html',
    pageHtml(site, categories, { title: p.title, description: p.content.metaDescription || p.content.shortDesc, canonical: site.url + pathOf(p), body, ogImage: p.seo.ogImage, type: 'article' }));
  if (p.seo.ogImage) write(p.seo.ogImage.replace(/^\//, ''), svgOg(p.title, cat ? cat.nameMr : 'अभ्यासक्रम'));
  count++;
  console.log(`  syllabus: ${pathOf(p)}`);
}

for (const p of syllabi) {
  if (!p.path || !p.syllabus) { console.error(`  [SKIP] incomplete syllabus record: ${p.id}`); continue; }
  renderSyllabus(p);
}

// /syllabus/ hub index — फक्त syllabus pages असतील तरच (thin page नियम)
if (syllabi.length) {
  const body = `
<div class="page-header"><h1>अभ्यासक्रम (Syllabus)</h1></div>
<p>प्रत्येक परीक्षेचा subject-wise अभ्यासक्रम, exam pattern आणि तयारीचे टिप्स.</p>
<div class="post-list">
${syllabi.map(p => `<a class="post-card" href="${pathOf(p)}"><div><span class="badge-cat">Syllabus</span></div><div class="title">${esc(p.title)}</div><div class="meta">अखेरचे अद्ययावत: ${esc((p.lastUpdatedAt || '').slice(0, 10))}</div></a>`).join('\n')}
</div>`;
  write('syllabus/index.html', pageHtml(site, categories, { title: 'अभ्यासक्रम — Syllabus (सर्व परीक्षा)', description: 'MPSC, पोलीस भरती, तलाठी इत्यादी परीक्षांचे subject-wise अभ्यासक्रम व exam pattern.', canonical: site.url + '/syllabus/', body }));
  console.log('  hub: /syllabus/');
}
console.log(`syllabus.mjs: ${count} syllabus pages generated`);

