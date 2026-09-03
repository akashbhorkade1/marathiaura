// Generates: homepage (index.html) + default OG image
import { loadSite, loadCategories, loadPosts, loadExams, loadTests, published, write, esc, pageHtml, postCard, svgOg, pathOf } from '../lib.mjs';

const site = loadSite();
const categories = loadCategories();
const posts = published(loadPosts()).sort((a, b) => String(b.lastUpdatedAt || '').localeCompare(String(a.lastUpdatedAt || '')));
const exams = published(loadExams());
const tests = loadTests();
const catById = Object.fromEntries(categories.map(c => [c.id, c]));

const latest = posts.filter(p => p.type === 'recruitment').slice(0, 10);
const updatesFeed = posts.flatMap(p => (p.updates || []).map(u => ({ p, u }))).slice(0, 5);
const caPosts = posts.filter(p => p.type === 'current-affairs').slice(0, 5);

const catCards = categories.filter(c => c.id !== 'latest-bharti').map(c =>
  `<a class="cat-card" href="${c.path}">${esc(c.nameMr)}<small>${esc(c.name)}</small></a>`).join('\n');

const examLinks = exams.map(e =>
  `<a class="post-card" href="${esc(pathOf(e))}"><div><span class="badge-cat">${esc(e.conductingBody)}</span></div><div class="title">${esc(e.examNameMr)}</div><div class="meta">${esc(e.examName)} · अभ्यासक्रम · Exam Pattern</div></a>`).join('\n');

const testLinks = tests.map(t =>
  `<a class="post-card" href="${esc(pathOf(t))}"><div><span class="badge-cat">Mock Test</span></div><div class="title">${esc(t.titleMr || t.title)}</div><div class="meta">${t.questionIds ? t.questionIds.length : 0} प्रश्न · ${t.durationMinutes} मिनिटे</div></a>`).join('\n');

const body = `
<section class="hero">
  <div class="wrap">
    <h1>स्पर्धा परीक्षेची तयारी आता आणखी सोपी!</h1>
    <p>${esc(site.tagline)}</p>
    <div class="cta-row">
      <a class="btn btn-light" href="/latest-bharti/">नवीन भरती पाहा</a>
      <a class="btn btn-accent" href="/mock-test/">मॉक टेस्ट द्या</a>
    </div>
  </div>
</section>

<section class="block wrap">
  <h2 class="section-title">नवीन भरती — Latest Recruitment</h2>
  <div class="post-list">
  ${latest.map(p => postCard(p, catById[p.category])).join('\n') || '<p>सध्या कोणती भरती उपलब्ध नाही.</p>'}
  </div>
</section>

${updatesFeed.length ? `<section class="block wrap"><h2 class="section-title">ताजे अपडेट्स</h2>
  <ul class="updates-list">${updatesFeed.map(x => `<li><span class="u-date">${esc((x.u.date || '').slice(0, 10))} — ${esc(x.p.title)}</span><br>${esc(x.u.note)}</li>`).join('')}</ul>
</section>` : ''}

<section class="block wrap">
  <h2 class="section-title">Exam-wise माहिती</h2>
  <div class="post-list">${examLinks || ''}</div>
</section>

<section class="block wrap">
  <h2 class="section-title">सर्व Categories</h2>
  <div class="cat-grid">
  ${catCards}
  </div>
</section>

${caPosts.length ? `<section class="block wrap"><h2 class="section-title">चालू घडामोडी</h2>
  <div class="post-list">${caPosts.map(p => postCard(p, catById[p.category])).join('\n')}</div>
</section>` : ''}

${testLinks ? `<section class="block wrap"><h2 class="section-title">मॉक टेस्ट</h2>
  <div class="post-list">${testLinks}</div>
</section>` : ''}

<section class="block wrap">
  <h2 class="section-title">महत्वाचे दुवे</h2>
  <div class="cat-grid">
    <a class="cat-card" href="/mpsc/rajyaseva/">MPSC राज्यसेवा</a>
    <a class="cat-card" href="/police-bharti/">पोलीस भरती</a>
    <a class="cat-card" href="/syllabus/">अभ्यासक्रम</a>
    <a class="cat-card" href="/current-affairs/">चालू घडामोडी</a>
    <a class="cat-card" href="/result/">निकाल</a>
    <a class="cat-card" href="/editorial-policy/">संपादन धोरण</a>
  </div>
</section>`;

write('index.html', pageHtml(site, categories, {
  title: 'MarathiAura — स्पर्धा परीक्षेची तयारी, एका ठिकाणी',
  description: site.description,
  canonical: site.url + '/',
  body,
  ogImage: '/og-default.svg'
}));
write('og-default.svg', svgOg('MarathiAura', 'स्पर्धा परीक्षा'));
console.log('homepage.mjs: index.html generated');
