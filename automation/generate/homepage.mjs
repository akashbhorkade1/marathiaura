// Generates: homepage (index.html) + default OG image
// User-first (Part 2/10): काय आहे → काय सापडेल → कुठे क्लिक करायचे. कोणतेही developer/repo details नाहीत.
import { loadSite, loadCategories, loadPosts, loadExams, loadTests, published, write, esc, pageHtml, postCard, svgOg, pathOf,
  statusBadge, recruitStatus, isClosed, generatedCategoryPaths } from '../lib.mjs';

const site = loadSite();
const categories = loadCategories();
const posts = published(loadPosts()).sort((a, b) => String(b.lastUpdatedAt || '').localeCompare(String(a.lastUpdatedAt || '')));
const exams = published(loadExams());
const tests = loadTests();
const catById = Object.fromEntries(categories.map(c => [c.id, c]));

const recPosts = posts.filter(p => p.type === 'recruitment');
const activeRec = recPosts.filter(p => !isClosed(p));
const closingSoon = activeRec.filter(p => recruitStatus(p) === 'CLOSING_SOON');
const featured = activeRec.filter(p => recruitStatus(p) !== 'CLOSING_SOON').slice(0, 8);
// प्रवेशपत्र / निकाल — category आणि machine-derived status दोन्हीकडून (dedupe by path)
const dedupe = list => list.filter((p, i, arr) => arr.findIndex(x => pathOf(x) === pathOf(p)) === i);
const admitCards = dedupe([...posts.filter(p => p.category === 'admit-card'), ...recPosts.filter(p => recruitStatus(p) === 'ADMIT_CARD')]).slice(0, 4);
const results = dedupe([...posts.filter(p => p.category === 'result' || p.category === 'answer-key'), ...recPosts.filter(p => recruitStatus(p) === 'RESULT')]).slice(0, 4);
const syllabi = posts.filter(p => p.type === 'syllabus').slice(0, 6);
const caPosts = posts.filter(p => p.type === 'current-affairs').slice(0, 4);

const catCards = categories
  .filter(c => c.id !== 'latest-bharti' && generatedCategoryPaths().has(c.path))
  .map(c => `<a class="cat-card" href="${c.path}">${esc(c.nameMr)}<small>${esc(c.name)}</small></a>`).join('\n');

const examLinks = exams.map(e =>
  `<a class="post-card" href="${esc(pathOf(e))}"><div><span class="badge-cat">${esc(e.conductingBody)}</span></div><div class="title">${esc(e.examNameMr)}</div><div class="meta">${esc(e.examName)} · अभ्यासक्रम · Exam Pattern</div></a>`).join('\n');

const testLinks = tests.map(t =>
  `<a class="post-card" href="${esc(pathOf(t))}"><div><span class="badge-cat">Mock Test</span></div><div class="title">${esc(t.titleMr || t.title)}</div><div class="meta">${t.questionIds ? t.questionIds.length : 0} प्रश्न · ${t.durationMinutes} मिनिटे</div></a>`).join('\n');

const EMPTY_ACTIVE = '<p class="empty-state">सध्या अर्ज सुरू असलेली नवीन भरती नाही — नवीन जाहिरात लगेच येथे दिसेल. खाली अभ्यासक्रम व मॉक टेस्ट पहा.</p>';

const body = `
<section class="hero">
  <div class="wrap">
    <h1>भरती, निकाल, प्रवेशपत्र आणि स्पर्धा परीक्षेची माहिती — एका ठिकाणी.</h1>
    <p>${esc(site.tagline)}</p>
    <div class="home-search">
      <form action="/search.html" method="get" role="search">
        <input type="search" name="q" placeholder="🔎 शोधा — उदा. Police, Talathi, 12वी भरती, Last Date..." aria-label="भरती शोधा">
        <button type="submit">शोधा</button>
      </form>
    </div>
    <div class="cta-row">
      <a class="btn btn-light" href="/latest-bharti/">नवीन भरती पाहा</a>
      <a class="btn btn-accent" href="/mock-test/">मॉक टेस्ट द्या</a>
    </div>
  </div>
</section>

<!--active-list-->
<section class="block wrap">
  <h2 class="section-title">🔥 नवीन भरती</h2>
  <div class="post-list">
  ${featured.map(p => postCard(p, catById[p.category])).join('\n') || EMPTY_ACTIVE}
  </div>
</section>

${closingSoon.length ? `<section class="block wrap"><h2 class="section-title">⏳ शेवटची तारीख जवळ</h2>
  <div class="post-list">${closingSoon.map(p => postCard(p, catById[p.category])).join('\n')}</div>
</section>` : ''}
<!--/active-list-->

${admitCards.length ? `<section class="block wrap"><h2 class="section-title">📄 प्रवेशपत्र (Admit Card)</h2>
  <div class="post-list">${admitCards.map(p => postCard(p, catById[p.category])).join('\n')}</div>
</section>` : ''}

${results.length ? `<section class="block wrap"><h2 class="section-title">🏆 निकाल व उत्तरतालिका</h2>
  <div class="post-list">${results.map(p => postCard(p, catById[p.category])).join('\n')}</div>
</section>` : ''}

${syllabi.length ? `<section class="block wrap"><h2 class="section-title">📚 अभ्यासक्रम (Syllabus)</h2>
  <div class="post-list">${syllabi.map(p => `<a class="post-card" href="${pathOf(p)}"><div><span class="badge-cat">Syllabus</span></div><div class="title">${esc(p.title)}</div><div class="meta">अखेरचे अद्ययावत: ${esc((p.lastUpdatedAt || '').slice(0, 10))}</div></a>`).join('\n')}</div>
</section>` : ''}

${testLinks ? `<section class="block wrap"><h2 class="section-title">🧠 मॉक टेस्ट</h2>
  <div class="post-list">${testLinks}</div>
</section>` : ''}

${caPosts.length ? `<section class="block wrap"><h2 class="section-title">📰 चालू घडामोडी</h2>
  <div class="post-list">${caPosts.map(p => postCard(p, catById[p.category])).join('\n')}</div>
</section>` : ''}

${examLinks ? `<section class="block wrap"><h2 class="section-title">परीक्षानिहाय माहिती (Exam-wise)</h2>
  <div class="post-list">${examLinks}</div>
</section>` : ''}

${catCards ? `<section class="block wrap">
  <h2 class="section-title">सर्व श्रेणी (Categories)</h2>
  <div class="cat-grid">
  ${catCards}
  </div>
</section>` : ''}`;

write('index.html', pageHtml(site, categories, {
  title: 'MarathiAura — भरती, निकाल, प्रवेशपत्र व स्पर्धा परीक्षा माहिती मराठीत',
  description: site.description,
  canonical: site.url + '/',
  body,
  ogImage: '/og-default.svg'
}));
write('og-default.svg', svgOg('MarathiAura', 'स्पर्धा परीक्षा'));
console.log('homepage.mjs: index.html generated');
