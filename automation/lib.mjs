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

export const loadSite = () => readJson('data/site.json').site;
export const loadCategories = () => readJson('data/categories.json');
export const loadPosts = () => readJsonDir('data/posts');
export const loadExams = () => readJsonDir('data/exams');
export const loadTests = () => readJsonDir('data/mock-tests');
export const loadQuestionBank = () => readJsonDir('data/questions').map(b => ({ exam: b.exam, questions: b.questions || [] }));
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
  return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(pub)}"\n     crossorigin="anonymous"></script>\n`;
}

export function headHtml(site, { title, description, canonical, ogImage = null, type = 'website', index = true }) {
  const noindex = index ? '' : '\n<meta name="robots" content="noindex, follow">';
  const img = ogImage || `${site.url}/og-default.svg`;
  return `<!DOCTYPE html>
<html lang="mr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex}
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="${esc(type)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="MarathiAura">
<meta property="og:locale" content="mr_IN">
<meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/style.css">
${adsenseHead(site)}</head>
`;
}

export function navHtml(categories) {
  const navCats = categories.filter(c => c.nav);
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
  const catLinks = categories.slice(0, 8).map(c => `<li><a href="${c.path}">${esc(c.nameMr)}</a></li>`).join('\n');
  return `<footer class="site">
<div class="wrap footer-grid">
  <div>
    <h3>MarathiAura</h3>
    <p>${esc(site.tagline)}</p>
    <p><small>हे कोणत्याही सरकारी संस्थेचे अधिकृत संकेतस्थळ नाही. स्रोत: अधिकृत जाहिराती.</small></p>
  </div>
  <div>
    <h3>Categories</h3>
    <ul>
    ${catLinks}
    </ul>
  </div>
  <div>
    <h3>महत्वाचे दुवे</h3>
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
  const badge = p.badge === 'urgent' ? '<span class="badge badge-urgent">तातडीचे</span>' : '<span class="badge badge-new">नवीन</span>';
  return `<a class="post-card" href="${esc(pathOf(p))}">
  <div><span class="badge-cat">${esc(cat ? cat.nameMr : '')}</span></div>
  <div class="title">${esc(p.title)}${badge}</div>
  <div class="meta">प्रकाशित: ${esc((p.publishedAt || p.lastUpdatedAt || '').slice(0, 10))} · अखेरचे अद्ययावत: ${esc((p.lastUpdatedAt || '').slice(0, 10))}</div>
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

