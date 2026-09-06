// Source Monitor — feeds वरून नवीन notifications detect करून draft records तयार करते
// नियम: AI स्वतः facts invent करू शकत नाही; फक्त source मधून आलेलीच माहिती जाते.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const writeJson = (p, o) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), JSON.stringify(o, null, 2) + '\n', 'utf8'); };

const site = read('data/site.json').site;
const categories = read('data/categories.json');
const loadDir = d => fs.existsSync(path.join(root, d))
  ? fs.readdirSync(path.join(root, d)).filter(f => f.endsWith('.json')).map(f => { try { return JSON.parse(fs.readFileSync(path.join(root, d, f), 'utf8')); } catch { return null; } }).filter(Boolean)
  : [];
const posts = loadDir('data/posts');

function stripTags(html) { return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function cdata(s) { const m = String(s || '').match(/<!\[CDATA\[([\s\S]*?)\]\]>/); return m ? m[1] : s; }
function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}
function xmlText(node) { return decodeEntities(stripTags(cdata(node))).trim(); } // नेहमी plain string — XmlElement नाही
// PIB सारखे सरकारी portals bot UA ला 403 देतात — browser-like UA आवश्यक (docs/04 §3)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const MAX_ITEMS = 15; // प्रति feed प्रति धाव जास्तीत जास्त drafts — network burst टाळा

async function fetchPage(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
function absolute(href, base) { try { return new URL(href, base).href; } catch { return null; } }
function cleanBody(html) { return decodeEntities(stripTags(html)).replace(/\s+/g, ' ').trim(); }
function extractAnchors(html, baseUrl) {
  const out = [];
  const re = /<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = absolute(m[1], baseUrl);
    const label = cleanBody(m[2]);
    if (href && label) out.push({ href, label });
  }
  return out;
}
// WordPress-सारख्या article pages मधून title + body extract (best-effort, zero-dependency)
function extractArticle(html) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = cleanBody(og ? og[1] : (h1 ? h1[1] : ''));
  const bodyMatch = html.match(/<div[^>]+class=["'][^"']*(entry-content|post-content|article-content|td-post-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
    || html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    || html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  return { title, body: bodyMatch ? cleanBody(bodyMatch[2] || bodyMatch[1]) : '' };
}


function normTitle(t) { return String(t).toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ''); }
function slugify(t) {
  const base = String(t).toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60).replace(/-+$/, '');
  const y = String(t).match(/20\d{2}/);
  return (base + (y && !base.includes(y[0]) ? `-${y[0]}` : '')) || `update-${Date.now()}`;
}
function detectCategory(title, fallback) {
  const t = String(title).toLowerCase();
  const map = [
    ['police-bharti', ['police', 'constable', 'पोलीस', 'सिपाही']],
    ['talathi', ['talathi', 'तलाठी']],
    ['mpsc', ['mpsc', 'rajyaseva', 'राज्यसेवा', 'संयुक्त']],
    ['railway', ['rrb', 'railway', 'ntpc', 'group d', 'alp', 'रेल्वे']],
    ['ssc', ['ssc', 'cgl', 'chsl', 'mts']],
    ['banking', ['ibps', 'sbi', 'bank', 'rbi', 'बँक']],
    ['gramsevak', ['gramsevak', 'ग्रामसेवक', 'zp ', 'जिल्हा परिषद']]
  ];
  for (const [cat, kws] of map) if (kws.some(k => t.includes(k))) return cat;
  return fallback || 'latest-bharti';
}
// article-list sources साठी non-article links exclude (category/tag/author/pdf/media सारखे)
const EXCLUDE_RE = /\/(category|tag|tags|author|page|wp-json|wp-admin|wp-login|feed|amp|search)(\/|$)|#|mailto:|tel:|\.(pdf|png|jpe?g|svg|webp|ico|css|js)($|\?)|-pdf(\/|$)|\/(about|contact|privacy|disclaimer|terms|faq|advertise)(\/|$)/i;

// Draft record — schema docs/02 §post प्रमाणे; recruitment किंवा current-affairs दोन्ही types
function makeDraft({ title, link, desc, body, feed }) {
  const cat = detectCategory(title, feed.category);
  const id = slugify(title);
  const now = new Date().toISOString();
  const catObj = categories.find(c => c.id === cat);
  const isCA = cat === 'current-affairs' || feed.postType === 'current-affairs';
  const summary = String(desc || title);
  return {
    id,
    type: isCA ? 'current-affairs' : 'recruitment',
    ...(isCA ? { kind: 'daily', date: now.slice(0, 10), items: [], itemSchema: 'docs/02-DATA-SCHEMA.md §3 — { id, question, answer, explanation, category, importance, source, tags }' } : {}),
    title,
    slug: id,
    path: isCA ? `/current-affairs/${id.replace(/^current-affairs-/, '')}/` : `/${id}/`,
    category: cat,
    exam: null,
    department: feed.name,
    recruitment: {
      postNames: [], vacancies: null, vacanciesNote: 'अधिकृत जाहिरातीत नमूद',
      qualification: [], ageLimit: null, salary: null, fee: null,
      applicationMode: null, location: 'भारत', jobType: 'government'
    },
    dates: { notification: null, applicationStart: null, applicationEnd: null, examDate: null, admitCardDate: null, resultDate: null },
    links: { notificationUrl: link || null, applyUrl: null, officialUrl: link || null },
    selectionProcess: [],
    syllabusRef: null, relatedMockTests: [],
    content: {
      shortDesc: summary.slice(0, 300),
      metaDescription: null,
      // Marathi template structure — source साठी credit; शब्दशः कॉपी नाही (docs/04 §2 rewrite policy)
      sections: [
        ...(body ? [{ heading: 'थोडक्यात', type: 'text', body: String(body).slice(0, 400) }] : []),
        { heading: 'सविस्तर माहिती', type: 'text', body: summary.slice(0, 800) }
      ],
      faqs: []
    },
    sources: [
      { url: link || feed.url, name: feed.name, priority: feed.priority || 2, role: 'notification', verifiedAt: now }
    ],
    status: 'ai-generated',
    confidence: 85, // semi-automated content → review queue (docs/04 §1 tiers)
    publishedAt: null,
    lastUpdatedAt: now,
    contentHash: null,
    updates: [],
    seo: { keywords: [title, catObj ? catObj.nameMr : cat, 'MarathiAura'], ogImage: `/og-images/${id}.svg`, index: false }
  };
}

const existingTitles = new Set(posts.map(p => normTitle(p.title)));
const existingLinks = new Set(posts.flatMap(p => [
  ...((p.sources || []).map(s => s.url)),
  p.source && p.source.url // V1 fallback
]).filter(Boolean));

let drafts = [];
for (const feed of (site.feeds || [])) {
  if (feed.verified === false) { console.log(`  [SKIP] ${feed.name}: unverified feed — आधी manually verify करा (docs/04 §3)`); continue; }
  try {
    console.log(`Fetching: ${feed.name} (${feed.type}) → ${feed.url}`);
    const collected = [];

    if (feed.type === 'rss') {
      const xml = await fetchPage(feed.url);
      const items = xml.split(/<item[\s>]/i).slice(1, 1 + MAX_ITEMS);
      for (const raw of items) {
        const get = tag => { const m = raw.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')); return m ? m[1] : ''; };
        const title = xmlText(get('title'));
        const link = xmlText(get('link'));
        const desc = xmlText(get('description')) || title;
        if (title) collected.push({ title, link, desc });
      }
    } else if (feed.type === 'html') {
      // Listing page वरून थेट links (जाहिरात PDFs सारखे) — article page fetch नाही (docs/04 §3.5)
      const html = await fetchPage(feed.url);
      const anchorRe = feed.anchorPattern ? new RegExp(feed.anchorPattern, 'i') : null;
      const anchorEx = feed.excludePattern ? new RegExp(feed.excludePattern, 'i') : null;
      const selfUrl = feed.url.split('#')[0];
      for (const a of extractAnchors(html, feed.url)) {
        if (a.href.split('#')[0] === selfUrl) continue; // self/nav link
        if (a.label.length < 8) continue;
        if (anchorRe && !(anchorRe.test(a.href) || anchorRe.test(a.label))) continue;
        if (anchorEx && (anchorEx.test(a.href) || anchorEx.test(a.label))) continue;
        collected.push({ title: a.label, link: a.href, desc: a.label });
      }
    } else if (feed.type === 'article-list') {
      // Listing page → नवीन article links → प्रत्येक article page fetch → title + body extract
      const html = await fetchPage(feed.url);
      const linkRe = feed.linkPattern ? new RegExp(feed.linkPattern, 'i') : null;
      const linkEx = feed.excludePattern ? new RegExp(feed.excludePattern, 'i') : null;
      const candidates = [];
      for (const a of extractAnchors(html, feed.url)) {
        if (a.label.length < 20) continue;
        if (EXCLUDE_RE.test(a.href)) continue;
        if (linkEx && (linkEx.test(a.href) || linkEx.test(a.label))) continue;
        if (new URL(a.href).origin !== new URL(feed.url).origin) continue;
        if (linkRe && !linkRe.test(a.href)) continue;
        candidates.push(a);
      }
      const maxFetch = feed.maxFetch || 3; // प्रति धावेत किती article pages fetch
      let fetched = 0;
      for (const a of candidates) {
        if (fetched >= maxFetch) break;
        const art = await fetchPage(a.href).then(extractArticle).catch(() => null);
        if (!art || !art.title) continue;
        fetched++;
        collected.push({ title: art.title, link: a.href, desc: art.body ? art.body.slice(0, 300) : a.label, body: art.body });
      }
    } else {
      console.log(`  [SKIP] ${feed.name}: type '${feed.type}' unsupported`);
      continue;
    }

    let added = 0;
    for (const item of collected) {
      if (added >= MAX_ITEMS) break;
      const { title, link, desc, body } = item;
      // Optional feed-level filter: फक्त matching titles चेच drafts (general news sources साठी — review-queue flood टाळा)
      if (Array.isArray(feed.keywords) && feed.keywords.length && !feed.keywords.some(k => title.toLowerCase().includes(String(k).toLowerCase()))) continue;
      if (existingTitles.has(normTitle(title)) || (link && existingLinks.has(link))) continue;

      drafts.push(makeDraft({ title, link, desc, body, feed }));
      existingTitles.add(normTitle(title));
      if (link) existingLinks.add(link);
      added++;
      console.log(`  NEW: ${title}`);
    }
  } catch (e) {
    // Failure isolation: एक feed fail झाला तरी बाकी चालू
    console.error(`  [ERROR] ${feed.name}: ${e.message}`);
  }
}

if (drafts.length) {
  // Drafts → data/posts (status: ai-generated → generator render करणार नाही)
  for (const d of drafts) writeJson(`data/posts/${d.id}.json`, d);
  // Review queue
  const queuePath = 'data/review-queue.json';
  const queue = fs.existsSync(path.join(root, queuePath)) ? read(queuePath) : [];
  queue.push(...drafts.map(d => ({ id: d.id, title: d.title, confidence: d.confidence, addedAt: d.lastUpdatedAt })));
  writeJson(queuePath, queue);
  console.log(`\nmonitor.mjs: ${drafts.length} draft(s) तयार — review-queue मध्ये पाठवले (human approval हवी)`);
} else {
  console.log('\nmonitor.mjs: कोणती नवीन notification नाही');
}

