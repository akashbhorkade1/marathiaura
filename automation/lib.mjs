// MarathiAura shared generator library
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = path.join(ROOT, process.env.OUT_DIR || '_site');

export function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}
export function readJsonDir(dir) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => {
    try { return JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); }
    catch (e) { console.error(`  [SKIP] invalid JSON: ${dir}/${f}: ${e.message}`); return null; }
  }).filter(Boolean);
}
export function write(rel, content) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8'); // UTF-8, no BOM
}
export function writeJson(rel, obj) { write(rel, JSON.stringify(obj, null, 2) + '\n'); }

export const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// ---------- Safe text extraction (Part 8 — source parsing hardening) ----------
// XML node → text content, Array → joined safe text, Object → explicit field
// extraction, null/undefined → empty safe value. NEVER implicit object-to-string.
export function safeText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(safeText).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    // XML parser nodes (xml2js `_`/`#text`, fast-xml-parser, DOM `textContent`) —
    // explicit field extraction only; never String(obj) → "System.Xml.XmlElement"
    for (const k of ['_', '#text', 'textContent', 'text', 'value', 'label', 'title', 'href', 'url']) {
      const val = v[k];
      if (val != null && typeof val !== 'object') {
        const t = String(val).trim();
        if (t) return t;
      }
    }
    return '';
  }
  return '';
}

// ---------- Recruitment status system (Part 3 — machine-derived from dates) ----------
// States: ACTIVE | CLOSING_SOON | CLOSED | ADMIT_CARD | RESULT | UPCOMING
// Rule: CLOSING_SOON = अर्ज शेवटची तारीखेला ≤ 7 दिवस बाकी. Dates are YYYY-MM-DD (IST).
export const CLOSING_SOON_DAYS = 7;
const DAY_MS = 86400000;
// IST calendar day (YYYY-MM-DD) for a timestamp — tests use UTC-based isoDate,
// production dates are IST YYYY-MM-DD, so all comparisons must use IST days.
const istToday = (now = Date.now()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date(now));

export function recruitStatus(p, now = Date.now()) {
  if (!p || p.type !== 'recruitment') return null;
  const d = p.dates || {};
  const today = istToday(now);
  // 0) निकाल जाहीर
  if (d.resultDate && today >= d.resultDate) return 'RESULT';
  // 1) अर्ज अजून सुरू नाही → UPCOMING (शेवटची तारीख लवकर असली तरी expired नसताना UPCOMINGच — अर्ज बंद दाखवू नये)
  //    Exception: शेवटची तारीख आधीच उलटली (bad data) → expiredच जिंकते, CLOSED/ADMIT_CARD (खाली).
  const notStarted = d.applicationStart && today < d.applicationStart;
  const alreadyEnded = d.applicationEnd && today > d.applicationEnd;
  if (notStarted && !alreadyEnded) return 'UPCOMING';
  // 2) शेवटची तारीख उलटली → CLOSED / ADMIT_CARD (expired कधीच active दिसू नये)
  if (alreadyEnded) {
    return (d.admitCardDate && today >= d.admitCardDate) ? 'ADMIT_CARD' : 'CLOSED';
  }
  // 3) अर्ज सुरू आणि शेवटची तारीख ≤ CLOSING_SOON_DAYS calendar दिवसांवर → CLOSING_SOON
  if (d.applicationEnd) {
    const daysLeft = Math.round((Date.parse(d.applicationEnd) - Date.parse(today)) / DAY_MS);
    if (daysLeft <= CLOSING_SOON_DAYS) return 'CLOSING_SOON';
  }
  return 'ACTIVE';
}

export const STATUS_META = {
  ACTIVE: { label: 'अर्ज सुरू', icon: '🟢', cls: 'badge-active' },
  CLOSING_SOON: { label: 'शेवटची तारीख जवळ', icon: '🟠', cls: 'badge-closing' },
  CLOSED: { label: 'अर्ज बंद', icon: '🔴', cls: 'badge-closed' },
  ADMIT_CARD: { label: 'प्रवेशपत्र उपलब्ध', icon: '🔵', cls: 'badge-admit' },
  RESULT: { label: 'निकाल जाहीर', icon: '🏆', cls: 'badge-result' },
  UPCOMING: { label: 'लवकरच येत आहे', icon: '🔜', cls: 'badge-upcoming' }
};

export function statusBadge(p) {
  const s = recruitStatus(p);
  if (!s) return '';
  const m = STATUS_META[s];
  return `<span class="badge ${m.cls}" data-status="${s}">${m.icon} ${m.label}</span>`;
}

export const isClosed = p => ['CLOSED', 'ADMIT_CARD', 'RESULT'].includes(recruitStatus(p));

// YYYY-MM-DD (किंवा full ISO) → DD-MM-YYYY display
export const fmtDate = v => {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

// Last Verified (Part 5) — फक्त sources[] मध्ये खरोखर verifiedAt असेल तरच; कधीच fabricate नाही
export function lastVerified(p) {
  const dates = (p && p.sources || []).map(s => s && s.verifiedAt).filter(Boolean)
    .map(v => String(v).slice(0, 10)).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

// Source trust (Part 14) — gov.in/nic.in hosts only are "official"
export function isOfficialUrl(u) {
  try {
    const x = new URL(u);
    if (x.protocol !== 'http:' && x.protocol !== 'https:') return false;
    const h = x.hostname.toLowerCase();
    return h === 'gov.in' || h.endsWith('.gov.in') || h === 'nic.in' || h.endsWith('.nic.in');
  } catch { return false; }
}
export const linkLabel = url => isOfficialUrl(url) ? 'अधिकृत जाहिरात / Notification' : 'माहिती स्रोत (तृतीय-पक्ष)';

export const loadSite = () => readJson('data/site.json').site;
export const loadCategories = () => readJson('data/categories.json');
export const loadPosts = () => readJsonDir('data/posts');
export const loadExams = () => readJsonDir('data/exams');
export const loadTests = () => readJsonDir('data/mock-tests');
export const loadQuestionBank = () => readJsonDir('data/questions').map(b => ({ exam: b.exam, questions: b.questions || [] }));

// Mock-test question resolution — mock-test.mjs आणि sitemap.mjs एकच नियम वापरतात
// (sitemap मध्ये फक्त प्रत्यक्षात generate होणारी test pages यावीत)
export function questionIndex() {
  const qById = new Map();
  for (const b of loadQuestionBank()) for (const q of (b.questions || [])) if (q && q.id) qById.set(q.id, q);
  return qById;
}
export function resolveTestQuestions(t, qById) {
  return (t.questionIds || []).map(id => qById.get(id)).filter(Boolean)
    .filter(q => q.question && q.correctAnswer && q.explanation); // explanation आवश्यक
}
export const isRenderableTest = (t, qById) => (t.questionIds || []).length > 0 && resolveTestQuestions(t, qById).length > 0;
export const loadPages = () => readJson('data/pages.json');

// Published records only (status workflow enforcement)
export const published = list => list.filter(p => p.status === 'published' || p.status === 'updated');

// Schema V2: slug = bare segment, path = full URL path
export const pathOf = p => p.path || ('/' + String(p.slug || '').replace(/^\/+|\/+$/g, '') + '/');

// AdSense publisher ID — कधीच public config मध्ये नाही (docs/04-AUTOMATION-DESIGN.md)
export const publisherId = () => process.env.ADSENSE_PUB_ID || null;

export function adsenseHead(site) {
  const a = site.adsense;
  const pub = publisherId();
  if (!a || !a.enabled || !pub) return '';
  return `<meta name="google-adsense-account" content="${esc(pub)}">\n<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(pub)}"\n     crossorigin="anonymous"></script>\n`;
}

// GA4 measurement ID — CI secret (GA4_MEASUREMENT_ID) मधून; secret नसेल तर site-default
// fallback (G-JQ33GWHJWE). Measurement ID public असते (प्रत्येक page HTML मध्ये दिसते) —
// hardcode हा secret violation नाही, पण override शक्यता env मधूनच.
// नेहमीच एकच gtag tag render होतो — duplicate Google tag कधीच नाही.
const DEFAULT_GA4_ID = 'G-JQ33GWHJWE';
export const ga4Id = () => process.env.GA4_MEASUREMENT_ID || DEFAULT_GA4_ID;
export function analyticsHead(site) {
  const a = site.analytics;
  if (!a || !a.enabled) return '';
  const id = ga4Id();
  return `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(id)}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', '${esc(id)}');
</script>
`;
}

// Google Search Console (HTML meta-tag verification) — code CI secret मधून; missing → render नाही
export const gscCode = () => process.env.GOOGLE_SITE_VERIFICATION || null;
export function searchConsoleHead() {
  const code = gscCode();
  return code ? `<meta name="google-site-verification" content="${esc(code)}">\n` : '';
}

export function headHtml(site, { title, description, canonical, ogImage = null, type = 'website', index = true }) {
  const noindex = index ? '' : '\n<meta name="robots" content="noindex, follow">';
  const img = ogImage
    ? (ogImage.startsWith('http') ? ogImage : site.url + ogImage)
    : `${site.url}/og-default.svg`;
  return `<!DOCTYPE html>
<html lang="mr">
<head>
${analyticsHead(site)}<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">

${noindex}
<link rel="canonical" href="${esc(canonical)}">
  <link rel="alternate" type="application/rss+xml" title="${esc(site.name)} — Latest Updates" href="${site.url}/feed.xml">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="${esc(type)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="MarathiAura">
<meta property="og:locale" content="mr_IN">
<meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/style.css">
${searchConsoleHead()}${adsenseHead(site)}</head>
`;
}

// Category paths that actually have generated pages (thin-page rule, docs/03 §3) —
// nav/footer/homepage कधीच 404 category links दाखवणार नाहीत.
let _availCats = null;
export function generatedCategoryPaths() {
  if (_availCats) return _availCats;
  const posts = published(loadPosts());
  const set = new Set();
  for (const c of loadCategories()) {
    if (c.id === 'latest-bharti') {
      if (posts.some(p => p.type === 'recruitment')) set.add(c.path);
    } else if (c.id === 'syllabus') {
      if (posts.some(p => p.type === 'syllabus')) set.add(c.path);
    } else if (posts.some(p => p.category === c.id)) {
      set.add(c.path);
    }
  }
  _availCats = set;
  return set;
}

// Breadcrumb — category link फक्त प्रत्यक्षात generate झालेल्या hub page साठी (404 links टाळा, Part 16)
export function breadcrumbHtml(cat) {
  const home = '<a href="/">Home</a>';
  if (!cat) return `<div class="breadcrumb">${home}</div>`;
  const plain = `<div class="breadcrumb">${home} › ${esc(cat.nameMr)}</div>`;
  if (!generatedCategoryPaths().has(cat.path)) return plain;
  return `<div class="breadcrumb">${home} › <a href="${esc(cat.path)}">${esc(cat.nameMr)}</a></div>`;
}

export function navHtml(categories) {
  const avail = generatedCategoryPaths();
  const navCats = categories.filter(c => c.nav && avail.has(c.path));
  const links = [
    '<a href="/">Home</a>',
    ...navCats.map(c => `<a href="${c.path}">${esc(c.nameMr)}</a>`)
  ];
  return `<header class="site">
<div class="wrap nav-row">
  <a class="brand" href="/">MarathiAura<span class="dot">.</span></a>
  <input type="checkbox" id="menu-toggle" class="menu-toggle" hidden>
  <label class="menu-btn" for="menu-toggle" aria-label="Menu">☰</label>
</div>
<nav class="main-nav wrap">
  ${links.join('\n  ')}
</nav>
<div class="wrap">
  <form class="search-box" action="/search.html" method="get" role="search">
    <input type="search" name="q" placeholder="भरती, निकाल, अभ्यासक्रम शोधा..." aria-label="Search">
    <button type="submit">शोधा</button>
  </form>
</div>
</header>`;
}

export function footerHtml(site, categories) {
  const avail = generatedCategoryPaths();
  const catLinks = categories.filter(c => avail.has(c.path)).slice(0, 8)
    .map(c => `<li><a href="${c.path}">${esc(c.nameMr)}</a></li>`).join('\n');
  return `<footer class="site">
<div class="wrap footer-grid">
  <div>
    <h3>MarathiAura</h3>
    <p>${esc(site.tagline)}</p>
    <p><small>हे कोणत्याही सरकारी संस्थेचे अधिकृत संकेतस्थळ नाही. स्रोत: अधिकृत जाहिराती.</small></p>
  </div>
  <div>
    <h3>श्रेणी (Categories)</h3>
    <ul>
    ${catLinks}
    </ul>
  </div>
  <div>
    <h3>महत्त्वाचे दुवे</h3>
    <ul>
      <li><a href="/about/">आमच्याविषयी</a></li>
      <li><a href="/contact/">संपर्क</a></li>
      <li><a href="/editorial-policy/">संपादन धोरण</a></li>
      <li><a href="/privacy-policy/">गोपनीयता धोरण</a></li>
      <li><a href="/terms/">नियम व अटी</a></li>
      <li><a href="/disclaimer/">अस्वीकरण</a></li>
    </ul>
  </div>
</div>
<div class="footer-bottom wrap">&copy; ${new Date().getFullYear()} MarathiAura — स्पर्धा परीक्षेची तयारी, एका ठिकाणी</div>
</footer>`;
}

export function pageHtml(site, categories, { title, description, canonical, body, ogImage, type = 'website', index = true }) {
  return headHtml(site, { title, description, canonical, ogImage, type, index }) +
    `<body>\n${navHtml(categories)}\n<main class="wrap">\n${body}\n</main>\n${footerHtml(site, categories)}\n</body>\n</html>\n`;
}

export function postCard(p, cat) {
  const st = statusBadge(p);
  const closed = recruitStatus(p) === 'CLOSED';
  const lastDate = p.dates && p.dates.applicationEnd ? fmtDate(p.dates.applicationEnd) : null;
  const dateMeta = p.type === 'recruitment' && lastDate ? `शेवटची तारीख: ${lastDate} · ` : '';
  // manual "urgent" badge कधीच expired record वर दिसू नये (Part 4) — machine status ने replace होते
  const legacyBadge = (!isClosed(p) && p.badge === 'urgent') ? '<span class="badge badge-urgent">तातडीचे</span>' : '';
  return `<a class="post-card${closed ? ' is-closed' : ''}" href="${esc(pathOf(p))}">
  <div><span class="badge-cat">${esc(cat ? cat.nameMr : '')}</span></div>
  <div class="title">${esc(p.title)}${st ? ' ' + st : legacyBadge}</div>
  <div class="meta">${dateMeta}प्रकाशित: ${esc((p.publishedAt || p.lastUpdatedAt || '').slice(0, 10))} · अखेरचे अद्ययावत: ${esc((p.lastUpdatedAt || '').slice(0, 10))}</div>
</a>`;
}

export function svgOg(title, category) {
  const t1 = title.slice(0, 46), t2 = title.slice(46, 92);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#0c447c"/><stop offset="100%" style="stop-color:#2074b8"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#bg)"/>
<rect width="1200" height="6" fill="#ff6f00"/>
<text x="60" y="110" font-family="Arial,sans-serif" font-size="30" fill="#ff6f00" font-weight="bold">${esc(category)}</text>
<text x="60" y="230" font-family="Arial,sans-serif" font-size="50" fill="#ffffff" font-weight="bold">${esc(t1)}</text>
<text x="60" y="300" font-family="Arial,sans-serif" font-size="50" fill="#ffffff" font-weight="bold">${esc(t2)}</text>
<rect x="60" y="350" width="100" height="4" fill="#ff6f00"/>
<text x="60" y="430" font-family="Arial,sans-serif" font-size="30" fill="#dce8f5">marathiaura.in</text>
<text x="60" y="480" font-family="Arial,sans-serif" font-size="24" fill="#a8c8e8">स्पर्धा परीक्षेची तयारी, एका ठिकाणी</text>
</svg>`;
}

