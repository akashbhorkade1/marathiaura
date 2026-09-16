// Build-output validator — हार्ड गेट: production-dangerous strings आल्यास build FAIL (Parts 7/21)
// Checks:
//  1. XML/object serialization leaks (System.Xml, XmlElement, [object Object], undefined, NaN) in HTML
//  2. Expired jobs rendered as active (applicationEnd पलीकडे → "अर्ज बंद" badge हवा; active sections मध्ये नाही)
//  3. Missing status badge on recruitment article pages
//  4. noindex pages included in sitemaps
//  5. Invalid sitemap entries (missing files, duplicate URLs, non-https)
//  6. Broken internal links (orphans/404 targets)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, OUT, loadPosts, published, recruitStatus, isClosed, pathOf } from './lib.mjs';

const GARBAGE = ['System.Xml', 'XmlElement', 'System.Xml.XmlElement', '[object Object]'];
// 'undefined'/'NaN' — फक्त visible text म्हणून (tags मध्ये), code identifiers टाळण्यासाठी
const VISIBLE_GARBAGE = [/>[^<]*\bundefined\b[^<]*</i, />[^<]*\bNaN\b[^<]*</];

const htmlFiles = [];
(function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith('.html')) htmlFiles.push(p);
  }
})(OUT);

const rel = f => path.relative(OUT, f).replace(/\\/g, '/');
const errors = [];
const warnings = [];

// ---------- 1. Serialization leaks (हार्ड fail) ----------
for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8');
  for (const g of GARBAGE) {
    if (html.includes(g)) errors.push(`serialization leak in ${rel(f)}: "${g}"`);
  }
  for (const re of VISIBLE_GARBAGE) {
    if (re.test(html)) errors.push(`visible garbage text in ${rel(f)}: ${re}`);
  }
}

// ---------- 2/3. Status + expired-active ----------
const recruitPosts = published(loadPosts()).filter(p => p.type === 'recruitment');
let badgeCount = 0;
for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8');
  if (html.includes('data-status=')) badgeCount++;
}
for (const p of recruitPosts) {
  const pf = path.join(OUT, pathOf(p).replace(/^\//, ''), 'index.html');
  if (!fs.existsSync(pf)) continue; // not rendered (noindex/thin) — OK
  const html = fs.readFileSync(pf, 'utf8');
  const expected = recruitStatus(p);
  const got = (html.match(/data-status="([A-Z_]+)"/) || [])[1];
  if (!got) { errors.push(`missing status badge on ${pathOf(p)}`); continue; }
  // badge कधीच manual/stale नसावा — dates वरून derive झालेल्या status शी जुळणेच
  if (got !== expected) errors.push(`status mismatch on ${pathOf(p)}: rendered ${got}, dates say ${expected}`);
  // expired page वर "अर्ज बंद" note हवा (Part 4)
  if (isClosed(p) && !html.includes('closed-note')) {
    errors.push(`expired recruitment ${pathOf(p)} missing closed note`);
  }
}

// Expired jobs must NOT appear in active-list sections of index pages
const expiredPaths = recruitPosts.filter(p => isClosed(p)).map(p => pathOf(p));
for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8');
  for (const m of html.matchAll(/<!--active-list-->([\s\S]*?)<!--\/active-list-->/g)) {
    for (const ep of expiredPaths) {
      if (m[1].includes(`href="${ep}"`)) {
        errors.push(`expired recruitment ${ep} listed as active in ${rel(f)}`);
      }
    }
  }
}

// ---------- 4/5. Sitemap validation ----------
const sitemapUrls = new Set();
const idxPath = path.join(OUT, 'sitemap.xml');
if (fs.existsSync(idxPath)) {
  const idx = fs.readFileSync(idxPath, 'utf8');
  const childMaps = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  for (const cm of childMaps) {
    const name = cm.replace(/^https?:\/\/[^/]+\//, '');
    const cf = path.join(OUT, name);
    if (!fs.existsSync(cf)) { errors.push(`sitemap index points to missing ${name}`); continue; }
    const xml = fs.readFileSync(cf, 'utf8');
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const u = m[1];
      if (sitemapUrls.has(u)) errors.push(`duplicate sitemap URL: ${u}`);
      sitemapUrls.add(u);
      if (!u.startsWith('https://')) errors.push(`non-https sitemap URL: ${u}`);
      const p = u.replace(/^https?:\/\/[^/]+/, '');
      const file = p === '/' ? 'index.html' : p.replace(/^\//, '') + (p.endsWith('/') ? 'index.html' : '');
      if (file && !fs.existsSync(path.join(OUT, file))) errors.push(`sitemap URL has no generated page: ${u}`);
    }
  }
  // noindex pages must not be in sitemap
  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, 'utf8');
    if (!/name="robots" content="noindex/i.test(html)) continue;
    const c = html.match(/rel="canonical" href="([^"]+)"/);
    if (c && sitemapUrls.has(c[1])) errors.push(`noindex page in sitemap: ${c[1]}`);
  }
} else {
  errors.push('sitemap.xml missing');
}

// ---------- 6. Internal links resolve (orphan/404 prevention — hard fail) ----------
// RSS discovery link (Part 17): every indexable page advertises /feed.xml —
// feed.xml must exist and contain only indexable URLs (no drafts/noindex).
const exists = p => {
  if (p === '/') return fs.existsSync(path.join(OUT, 'index.html'));
  const clean = p.split('#')[0].split('?')[0];
  if (!clean || !clean.startsWith('/')) return true;
  if (clean.endsWith('/')) return fs.existsSync(path.join(OUT, clean.replace(/^\//, ''), 'index.html'));
  return fs.existsSync(path.join(OUT, clean.replace(/^\//, '')));
};
for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8');
  for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
    if (!exists(m[1])) errors.push(`internal link 404 in ${rel(f)}: ${m[1]}`);
  }
}

// ---------- 6b. RSS feed integrity (Part 17) ----------
const feedPath = path.join(OUT, 'feed.xml');
if (!fs.existsSync(feedPath)) {
  errors.push('feed.xml missing (RSS discovery broken)');
} else {
  const feed = fs.readFileSync(feedPath, 'utf8');
  for (const g of GARBAGE) {
    if (feed.includes(g)) errors.push(`serialization leak in feed.xml: "${g}"`);
  }
  const noindexUrls = new Set();
  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, 'utf8');
    if (!/name="robots" content="noindex/i.test(html)) continue;
    const c = html.match(/rel="canonical" href="([^"]+)"/);
    if (c) noindexUrls.add(c[1]);
  }
  for (const m of feed.matchAll(/<link>([^<]+)<\/link>/g)) {
    if (noindexUrls.has(m[1])) errors.push(`noindex URL in feed.xml: ${m[1]}`);
  }
}

// ---------- 7. Indexability invariants (Parts 15/16) ----------
const canonicalOf = html => (html.match(/rel="canonical" href="([^"]+)"/) || [])[1] || '';
const isNoindex = html => /name="robots" content="noindex/i.test(html);

// 7a. महत्त्वाची pages कधीच accidentally noindex नसावीत (indexable असावी अशा records)
const important = new Set(['index.html']);
for (const p of recruitPosts) {
  if (p.seo && p.seo.index === false) continue; // जाणीवपूर्वक noindex — sitemap बाहेर
  important.add(pathOf(p).replace(/^\//, '') + 'index.html');
}
for (const f of htmlFiles) {
  const r = rel(f);
  const html = fs.readFileSync(f, 'utf8');
  if (!isNoindex(html)) continue;
  // sitemap मध्ये असलेला कोणताही URL noindex नसावा (already checked) — इथे उलट नियम:
  if (important.has(r)) errors.push(`important page accidentally noindex: ${r}`);
}

// 7b. Indexable page → sitemap मध्ये असणेच (discoverability)
for (const f of htmlFiles) {
  const r = rel(f);
  const html = fs.readFileSync(f, 'utf8');
  if (isNoindex(html)) continue;
  const c = canonicalOf(html);
  if (!c) { errors.push(`missing canonical in ${r}`); continue; }
  if (!sitemapUrls.has(c)) errors.push(`indexable page missing from sitemap: ${c} (${r})`);
}

console.log(`validate-output.mjs: ${htmlFiles.length} html pages · sitemap ${sitemapUrls.size} urls · status badges on ${badgeCount} pages`);
for (const w of [...new Set(warnings)]) console.log(`  [WARN] ${w}`);
if (errors.length) {
  console.error('\n✗ BUILD OUTPUT FAILED validation — production-dangerous content found:');
  for (const e of [...new Set(errors)]) console.error(`  [ERROR] ${e}`);
  process.exit(1);
}
console.log('validate-output.mjs: ✓ clean');