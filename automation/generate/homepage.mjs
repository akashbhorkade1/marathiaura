// Generates: homepage (index.html) + default OG image
// Homepage v2 (Phase 1+2) — Hero + Quick-links strip + ताज्या भरती (job cards) + शेवटची तारीख sidebar + अभ्यास साधनं.
// User-first (Part 2/10): काय आहे → काय सापडेल → कुठे क्लिक करायचे. कोणतेही developer/repo details नाहीत.
// नियम: active sections नेहमी <!--active-list--> markers मध्ये (validate-output gate);
//       फक्त प्रत्यक्षात generate झालेलीच paths link होतील; source-मध्ये नसलेली facts कधीच render होत नाहीत.
import { loadSite, loadCategories, loadPosts, loadTests, published, write, esc, pageHtml, pathOf, svgOg,
  safeText, fmtDate, statusBadge, recruitStatus, isClosed, generatedCategoryPaths, questionIndex, isRenderableTest } from '../lib.mjs';

const site = loadSite();
const categories = loadCategories();
const posts = published(loadPosts()).sort((a, b) => String(b.lastUpdatedAt || '').localeCompare(String(a.lastUpdatedAt || '')));
const avail = generatedCategoryPaths();
const testsRenderable = loadTests().some(t => isRenderableTest(t, questionIndex()));

const recPosts = posts.filter(p => p.type === 'recruitment');
const activeRec = recPosts.filter(p => !isClosed(p));
const closingSoon = activeRec.filter(p => recruitStatus(p) === 'CLOSING_SOON');
const featured = activeRec.filter(p => recruitStatus(p) !== 'CLOSING_SOON').slice(0, 6);

// शेवटची तारीख sidebar — फक्त active records ज्यांची applicationEnd जाहीर आहे, जवळची आधी (top 4)
const withDeadline = activeRec
  .filter(p => p.dates && p.dates.applicationEnd)
  .sort((a, b) => String(a.dates.applicationEnd).localeCompare(String(b.dates.applicationEnd)))
  .slice(0, 4);

// Phase 2 — graceful fallback: active भरती आहेत पण तारखा जाहीर नाहीत → खोटी तारीख न देता
// स्पष्ट empty-state दाखवा (docs/04: source-मध्ये नसलेली facts कधीच render नाहीत)
const showSidebar = withDeadline.length > 0 || activeRec.length > 0;

// Category index cards — फक्त generated hubs (thin-page rule, docs/03 §3)
const catCards = categories
  .filter(c => c.id !== 'latest-bharti' && avail.has(c.path))
  .map(c => `<a class="cat-card" href="${c.path}">${esc(c.nameMr)}<small>${esc(c.name)}</small></a>`).join('\n');

// लोकप्रिय शोध — फक्त अस्तित्वात असलेल्या category hubs (404 links टाळा)
const POPULAR_IDS = ['police-bharti', 'mpsc', 'talathi', 'ssc', 'railway', 'banking', 'maharashtra-bharti', 'gramsevak'];
const popularTags = categories
  .filter(c => c.id !== 'latest-bharti' && POPULAR_IDS.includes(c.id) && avail.has(c.path))
  .map(c => `<a class="tag" href="${c.path}">${esc(c.nameMr)}</a>`).join('\n');

// "सर्व पहा" link फक्त /latest-bharti/ खरोखर generate झाला असेल तरच
const latestLink = avail.has('/latest-bharti/') ? '<a href="/latest-bharti/">सर्व पहा →</a>' : '';

// Phase 2 — Quick-links strip: फक्त प्रत्यक्षात generate झालेलीच pages link होतील (Phase 1 नियम).
// Last Date card फक्त तेव्हाच जेव्हा deadline sidebar खरोखर render होतो (dead anchor कधीच नाही)
// WhatsApp group card — site.social.whatsapp (data/site.json) मधून; तिथे असेल तरच दिसेल.
const waLink = safeText(site.social && site.social.whatsapp);
const quickLinks = [
  { href: '/latest-bharti/', icon: '📢', label: 'नवीन भरती', sub: 'Latest Bharti' },
  ...(withDeadline.length ? [{ href: '#closing-soon', icon: '⏳', label: 'शेवटची तारीख', sub: 'Last Date' }] : []),
  { href: '/admit-card/', icon: '📄', label: 'प्रवेशपत्र', sub: 'Admit Card' },
  { href: '/result/', icon: '🏆', label: 'निकाल', sub: 'Result' },
  { href: '/syllabus/', icon: '📚', label: 'अभ्यासक्रम', sub: 'Syllabus' },
  { href: '/mock-test/', icon: '🧠', label: 'मॉक टेस्ट', sub: 'Mock Test' },
  ...(waLink ? [{ href: waLink, img: '/assets/img/whatsapp.jpg', label: 'WhatsApp जॉइन करा', sub: 'WhatsApp Group', external: true }] : [])
].filter(t => t.external || t.href.startsWith('#') || (t.href === '/mock-test/' ? testsRenderable : avail.has(t.href)));

// Job card (clean modern mobile-first design)
// Structure: <article> container — no nested clickable links.
//   CTA link (internal article) + optional official link are sibling <a> elements.
// Status badge shown only when date data exists (verified).
function jobCard(p) {
  const r = p.recruitment || {};
  const dept = safeText(p.department) || '';
  const postNames = (r.postNames || []).map(safeText).filter(Boolean);
  const postNameSubtitle = postNames.length ? postNames[0] : '';
  const vacNum = Number(r.vacancies);
  const vac = (r.vacancies != null && Number.isFinite(vacNum))
    ? vacNum.toLocaleString('en-IN') + ' जागा'
    : '';
  const qual = (r.qualification || [])
    .map(safeText)
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');
  const lastDate = p.dates && p.dates.applicationEnd ? fmtDate(p.dates.applicationEnd) : '';
  const officialUrl =
    p.links && p.links.applyUrl && String(p.links.applyUrl).startsWith('https://')
      ? p.links.applyUrl
      : null;
  // Verified status label — only when date data exists to back it
  const hasDateData = p.dates &&
    (p.dates.applicationEnd || p.dates.applicationStart || p.dates.resultDate || p.dates.admitCardDate);
  const badgeHtml = hasDateData ? statusBadge(p) : '';
  const hasStatus = !!badgeHtml;

  return `<article class="job-card"${hasStatus ? ' data-status="' + recruitStatus(p) + '"' : ''}>
    ${dept ? `<div class="job-org">${esc(dept)}</div>` : ''}
    <h3 class="job-title">${esc(p.title)}</h3>
    ${postNameSubtitle ? `<p class="job-subtitle">${esc(postNameSubtitle)}</p>` : ''}
    ${badgeHtml ? `<div class="job-status">${badgeHtml}</div>` : ''}
    <div class="job-info">
      ${vac ? `<div class="job-info-item"><span class="job-info-label">एकूण जागा</span><span class="job-info-value">${esc(vac)}</span></div>` : ''}
      ${lastDate ? `<div class="job-info-item"><span class="job-info-label">अर्ज शेवट</span><span class="job-info-value">${esc(lastDate)}</span></div>` : ''}
    </div>
    ${qual ? `<div class="job-eligibility"><span class="lbl">पात्रता:</span> ${esc(qual)}</div>` : ''}
    <div class="job-actions">
      <a href="${esc(pathOf(p))}" class="jbtn jbtn-solid">संपूर्ण माहिती वाचा →</a>
      ${officialUrl ? `<a href="${esc(officialUrl)}" class="jbtn jbtn-outline official-link" target="_blank" rel="noopener">अधिकृत संकेतस्थळ ↗</a>` : ''}
    </div>
  </article>`;
}

// Deadline item — daysLeft IST calendar-day ने (recruitStatus प्रमाणेच)
function daysLeftOf(p) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return Math.round((Date.parse(p.dates.applicationEnd) - Date.parse(today)) / 86400000);
}
function deadlineItem(p) {
  const left = Math.max(0, daysLeftOf(p));
  return `<a class="deadline-item" href="${esc(pathOf(p))}">
  <span class="days-left"><span class="n">${left}</span><small>दिवस</small></span>
  <span class="deadline-info">
    <span class="d-title">${esc(p.title)}</span>
    <span class="d-date">शेवटची तारीख: ${esc(fmtDate(p.dates.applicationEnd))}</span>
  </span>
</a>`;
}

const popularHtml = popularTags ? `<div class="popular-tags"><span>लोकप्रिय शोध :</span>${popularTags}</div>` : '';
const jobsHtml = featured.map(p => jobCard(p)).join('\n') ||
  '<p class="empty-state">सध्या अर्ज सुरू असलेली नवीन भरती नाही — नवीन जाहिरात लगेच येथे दिसेल. खाली अभ्यास साधनं पहा.</p>';
const deadlinesHtml = withDeadline.map(p => deadlineItem(p)).join('\n');

// ⏳ लवकर बंद होणार — closing-soon भरतींचे पूर्ण cards (शेवटची तारीख जवळपासल्या पहिल्या).
// फक्त activeRec मधील CLOSING_SOON (≤7 दिवस) — expired कधीच इथे render होत नाही (active-list gate).
const closingSoonHtml = [...closingSoon]
  .sort((a, b) => String(a.dates.applicationEnd).localeCompare(String(b.dates.applicationEnd)))
  .map(p => jobCard(p)).join('\n');

// अभ्यास साधनं — फक्त प्रत्यक्षात generate झालेलीच pages link करा
const studyTools = [
  { href: '/syllabus/', icon: '📚', label: 'अभ्यासक्रम', sub: 'Syllabus' },
  { href: '/mock-test/', icon: '🧠', label: 'मॉक टेस्ट', sub: 'Mock Test' },
  { href: '/previous-papers/', icon: '📄', label: 'जुन्या प्रश्नपत्रिका', sub: 'Previous Papers' },
  { href: '/study-material/', icon: '✍️', label: 'अभ्यास साहित्य', sub: 'Study Material' }
].filter(t => t.href === '/mock-test/' ? testsRenderable : avail.has(t.href));

const body = `
<section class="home-hero">
  <div class="wrap">
    <h1>महाराष्ट्र सरकारी भरती आणि स्पर्धा परीक्षा अपडेट <span class="hl">विश्वसनीय माहिती, मराठीत.</span></h1>
    <p class="hero-sub">${esc(site.tagline)}</p>
    <div class="home-search">
      <form action="/search.html" method="get" role="search">
        <input type="search" name="q" placeholder="भरती / पद / संस्था शोधा..." aria-label="भरती शोधा">
        <button type="submit">शोधा</button>
      </form>
    </div>
    ${popularHtml}
  </div>
</section>

${quickLinks.length ? `
<section class="wrap" aria-label="महत्त्वाचे विभाग">
  <div class="quick-grid">
  ${quickLinks.map(t => `<a class="cat-card quick-card" href="${esc(t.href)}"${t.external ? ' target="_blank" rel="noopener"' : ''}><span class="ico">${t.img ? `<img class="ico-img" src="${esc(t.img)}" alt="" width="30" height="30" loading="lazy">` : t.icon}</span>${esc(t.label)}<small>${esc(t.sub)}</small></a>`).join('\n')}
  </div>
</section>` : ''}

<div class="wrap home-main">
<!--active-list-->
  <section class="home-jobs">
    <div class="section-head">
      <h2 class="section-title">🔥 आत्ता अर्ज करता येणाऱ्या भरती</h2>
      ${latestLink}
    </div>
    <div class="job-list">
    ${jobsHtml}
    </div>
  </section>
${showSidebar ? `
  <aside class="home-side" id="closing-soon">
    <div class="section-head">
      <h2 class="section-title">⏳ शेवटची तारीख जवळ</h2>
      ${latestLink}
    </div>
    ${withDeadline.length ? `<div class="deadline-list">
    ${deadlinesHtml}
    </div>` : '<p class="empty-state">सध्या निश्चित अंतिम तारीख उपलब्ध नाही — अधिकृत जाहिरात प्रसिद्ध होताच येथे दिसेल.</p>'}
  </aside>` : ''}
<!--/active-list-->
</div>

${closingSoonHtml ? `
<!--active-list-->
<section class="block wrap home-closing" aria-label="लवकर बंद होणाऱ्या भरती">
  <div class="section-head">
    <h2 class="section-title">⏳ लवकर बंद होणाऱ्या भरती</h2>
    ${latestLink}
  </div>
  <div class="job-list">
  ${closingSoonHtml}
  </div>
</section>
<!--/active-list-->` : ''}

${studyTools.length ? `
<section class="block wrap">
  <h2 class="section-title">अभ्यासासाठी उपयुक्त साधनं</h2>
  <div class="cat-grid">
  ${studyTools.map(t => `<a class="cat-card tool-card" href="${t.href}"><span class="ico">${t.icon}</span>${esc(t.label)}<small>${esc(t.sub)}</small></a>`).join('\n')}
  </div>
</section>` : ''}

${catCards ? `<section class="block wrap">
  <h2 class="section-title">सर्व श्रेणी (Categories)</h2>
  <div class="cat-grid">
  ${catCards}
  </div>
</section>` : ''}`;

write('index.html', pageHtml(site, categories, {
  title: 'महाराष्ट्र सरकारी भरती 2026, सरकारी नोकरी अपडेट | MarathiAura',
  description: site.description,
  canonical: site.url + '/',
  body,
  ogImage: '/og-default.svg',
  quickStrip: false // homepage वर strip ची स्वतःची जागा आहे (quick-links section) — duplicate टाळा
}));
write('og-default.svg', svgOg('MarathiAura', 'स्पर्धा परीक्षा'));
console.log('homepage.mjs: index.html generated (v2 — hero + quick-links + jobs + deadlines)');
