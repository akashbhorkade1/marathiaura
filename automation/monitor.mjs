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
const existingTitles = new Set(posts.map(p => normTitle(p.title)));
const existingLinks = new Set(posts.flatMap(p => [
  ...((p.sources || []).map(s => s.url)),
  p.source && p.source.url // V1 fallback
]).filter(Boolean));

let drafts = [];
for (const feed of (site.feeds || [])) {
  if (feed.verified === false) { console.log(`  [SKIP] ${feed.name}: unverified feed — आधी manually verify करा (docs/04 §3)`); continue; }
  if (feed.type !== 'rss') { console.log(`  [SKIP] ${feed.name}: type '${feed.type}' supported later`); continue; }
  try {
    console.log(`Fetching: ${feed.name} → ${feed.url}`);
    const res = await fetch(feed.url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'MarathiAuraBot/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = xml.split(/<item[\s>]/i).slice(1, 16);
    for (const raw of items) {
      const get = tag => { const m = raw.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')); return m ? m[1] : ''; };
      const title = xmlText(get('title'));
      const link = xmlText(get('link'));
      const desc = xmlText(get('description')) || title;
      if (!title) continue;
      if (existingTitles.has(normTitle(title)) || (link && existingLinks.has(link))) continue;

      const cat = detectCategory(title, feed.category);
      const id = slugify(title);
      const now = new Date().toISOString();
      const catObj = categories.find(c => c.id === cat);

      drafts.push({
        id, type: 'recruitment',
        title,
        slug: id,
        path: `/${id}/`,
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
          shortDesc: desc.slice(0, 300),
          metaDescription: null,
          sections: [{ heading: 'सविस्तर माहिती', type: 'text', body: desc.slice(0, 800) }],
          faqs: []
        },
        sources: [
          { url: link || feed.url, name: feed.name, priority: feed.priority || 2, role: 'notification', verifiedAt: now }
        ],
        status: 'ai-generated',
        confidence: 85, // semi-automated recruitment content → review queue
        publishedAt: null,
        lastUpdatedAt: now,
        contentHash: null,
        updates: [],
        seo: { keywords: [title, catObj ? catObj.nameMr : cat, 'MarathiAura'], ogImage: `/og-images/${id}.svg`, index: false }
      });
      existingTitles.add(normTitle(title));
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

