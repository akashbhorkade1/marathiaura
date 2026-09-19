// Source Monitor — feeds वरून नवीन notifications detect करून draft records तयार करते
// नियम: AI स्वतः facts invent करू शकत नाही; फक्त source मधून आलेलीच माहिती जाते.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeText } from './lib.mjs'; // Part 8 — parser-object → plain text कधीच String(obj) नाही
import { normalizeFacts, detectCategoryFacts } from './normalize.mjs';
import { findCanonical, SIM_THRESHOLD, titleSimilarity } from './dedup.mjs';
import { classifyUrl, resolveConflict, FAKE_URGENCY_RE, PLACEHOLDER_RE } from './verify-official.mjs';
import { buildTitle, buildShortDesc, buildSections, buildLinksSection, shingleSimilarity, COPY_THRESHOLD } from './generate-original-mr.mjs';

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
// safeText normalization (Part 8): RSS/HTML/object/array/null कोणतेही असले तरी नेहमी plain string
// Pipeline (docs/05 §3): raw item → NORMALIZE facts → ORIGINAL Marathi generation.
// §14: source body कधीच थेट paste होत नाही — फक्त facts (dates/संख्या/पदे) वरून नवीन मराठी article.
function makeDraft({ title, link, desc, body, feed }) {
  title = safeText(title);
  link = safeText(link);
  desc = safeText(desc);
  body = safeText(body);
  const now = new Date().toISOString();
  const facts = normalizeFacts({ title, body: `${desc} ${body}`, sourceUrl: link || feed.url, sourceName: feed.name, sourcePriority: feed.priority || 2, sourceType: feed.type, retrievedAt: now });
  // §21 copy gate: generated content source text शी copied असल्यास तो source वापरूच नये
  const sections = buildSections(facts);
  const genText = sections.map(s => [...(s.items || []), s.body, ...(s.rows || []).flat()].filter(Boolean).join(' ')).join(' ');
  const copySim = body ? shingleSimilarity(genText, body) : 0;
  const flagged = [
    ...(copySim >= COPY_THRESHOLD ? ['copied-source'] : []),
    ...(FAKE_URGENCY_RE.test(`${title} ${genText}`) ? ['fake-urgency'] : []),
    ...(PLACEHOLDER_RE.test(`${title} ${genText}`) ? ['placeholder'] : [])
  ];
  const cat = detectCategoryFacts(facts, detectCategory(title, feed.category));
  const genTitle = buildTitle(facts) || title;
  const id = slugify(genTitle);
  const catObj = categories.find(c => c.id === cat);
  const isCA = cat === 'current-affairs' || feed.postType === 'current-affairs';
  const links = buildLinksSection(facts) ? facts.links : { notificationUrl: link || null, applyUrl: null, officialUrl: null };
  return {
    id,
    type: isCA ? 'current-affairs' : 'recruitment',
    ...(isCA ? { kind: 'daily', date: now.slice(0, 10), items: [], itemSchema: 'docs/02-DATA-SCHEMA.md §3 — { id, question, answer, explanation, category, importance, source, tags }' } : {}),
    title: genTitle,
    slug: id,
    path: isCA ? `/current-affairs/${id.replace(/^current-affairs-/, '')}/` : `/${id}/`,
    category: cat,
    exam: null,
    department: facts.organization || feed.name,
    recruitment: {
      postNames: facts.postNames, vacancies: facts.vacancies, vacanciesNote: facts.vacancies ? null : 'अधिकृत जाहिरातीत नमूद',
      qualification: facts.qualification, ageLimit: facts.ageLimit, salary: facts.salary, fee: facts.fee,
      applicationMode: null, location: facts.location || 'भारत', jobType: 'government'
    },
    dates: facts.dates,
    links,
    selectionProcess: facts.selectionProcess,
    syllabusRef: null, relatedMockTests: [],
    content: {
      shortDesc: isCA ? (desc || title).slice(0, 300) : buildShortDesc(facts).slice(0, 300),
      metaDescription: null,
      // §8/§14: फक्त facts-आधारित original Marathi sections — source paragraph कधीच नाही
      sections: isCA ? [
        { heading: 'थोडक्यात', type: 'text', body: (desc || title).slice(0, 400) }
      ] : sections,
      faqs: []
    },
    sources: [
      { url: link || feed.url, name: feed.name, priority: feed.priority || 2, role: 'notification', verifiedAt: now }
    ],
    // §22 provenance — internal tracking; public render नाही
    provenance: {
      sourceName: feed.name, sourceUrl: link || feed.url, sourceType: feed.type,
      officialUrl: facts.links.officialUrl || null, officialNotificationUrl: null,
      retrievedAt: now, verifiedAt: null,
      confidence: 85, contentHash: null,
      copySimilarity: Number(copySim.toFixed(4)), flags: flagged
    },
    ...(flagged.length ? { needsReview: true } : {}),
    ...(feed.rewrite ? { rewritePending: true } : {}), // AI-rewrite झाल्यावर rewrite.mjs काढतो
    status: 'ai-generated',
    confidence: 85, // semi-automated content → review queue (docs/04 §1 tiers)
    publishedAt: null,
    lastUpdatedAt: now,
    contentHash: null,
    updates: [],
    seo: { keywords: [genTitle, catObj ? catObj.nameMr : cat, 'MarathiAura'], ogImage: `/og-images/${id}.svg`, index: false }
  };
}

const existingTitles = new Set(posts.map(p => normTitle(p.title)));
const existingLinks = new Set(posts.flatMap(p => [
  ...((p.sources || []).map(s => s.url)),
  p.source && p.source.url // V1 fallback
]).filter(Boolean));

// §6 merge — जास्त trusted (लहान priority number) चा non-null fact जिंकतो; फक्त source-supported values
function applyFacts(rec, facts, feed) {
  const now = new Date().toISOString();
  const better = !rec.provenance || (feed.priority || 2) <= (rec.provenance.priority ?? 4);
  if (better) {
    if (!rec.department && facts.organization) rec.department = facts.organization;
    if (facts.vacancies != null && (rec.recruitment.vacancies == null || better)) rec.recruitment.vacancies = facts.vacancies;
    if (facts.advtNo && !rec.advtNo) rec.advtNo = facts.advtNo;
    for (const k of Object.keys(rec.dates)) {
      if (facts.dates[k] && (!rec.dates[k] || better)) rec.dates[k] = facts.dates[k];
    }
    if ((facts.qualification || []).length && !(rec.recruitment.qualification || []).length) rec.recruitment.qualification = facts.qualification;
    if (facts.ageLimit && !rec.recruitment.ageLimit) rec.recruitment.ageLimit = facts.ageLimit;
    if (facts.fee && !rec.recruitment.fee) rec.recruitment.fee = facts.fee;
  }
  // provenance — दोन्ही sources track (§22)
  rec.provenance = { ...(rec.provenance || { priority: feed.priority || 2 }), priority: Math.min(rec.provenance?.priority ?? 4, feed.priority || 2), crossSources: [...new Set([...(rec.provenance?.crossSources || []), feed.name])] };
  rec.sources.push({ url: facts.source.url, name: feed.name, priority: feed.priority || 2, role: 'reference', verifiedAt: now });
  rec.lastUpdatedAt = now;
}

let drafts = [];
const updateQueue = []; // §18: published record बदलला → update candidate (review queue, auto-edit नाही)
for (const feed of (site.feeds || [])) {
  if (feed.verified === false) { console.log(`  [SKIP] ${feed.name}: unverified feed — आधी manually verify करा (docs/04 §3)`); continue; }
  try {
    console.log(`Fetching: ${feed.name} (${feed.type}) → ${feed.url}`);
    const collected = [];

    if (feed.type === 'rss') {
      const xml = await fetchPage(feed.url);
      const items = xml.split(/<item[\s>]/i).slice(1, 1 + MAX_ITEMS);
      for (const raw of items) {
        // `<tag attr="…">` attributes (उदा. System.Xml serialization metadata) कधीच content मध्ये जाऊ नयेत.
        // `<tag attr="…">` attributes (उदा. System.Xml serialization metadata) कधीच content मध्ये जाऊ नयेत —
        // फक्त inner text काढा (get attrs strip करते), outer tag string कधीच paste नाही.
        const get = tag => { const m = raw.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')); return m ? m[1].replace(/<[^>]+>/g, ' ').trim() : ''; };
        const titleRaw = get('title');
        const link = xmlText(get('link'));
        if (!titleRaw || !link) continue; // blank item → skip (कधीच raw XML paste नाही)
        // Raw CDATA/XML wrapper किंवा serialization attrs (System.Xml / XmlElement) कधीच draft मध्ये जाऊ नयेत —
        // फक्त plain-text content; दिसणारा garbage आढळल्यास item skip.
        const title = xmlText(titleRaw);
        if (!title) continue;
        const desc = xmlText(get('description')) || title;
        if (/System\.Xml|XmlElement|\[object Object\]/.test(`${title} ${desc}`)) continue;
        collected.push({ title, link, desc });
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

      // §6 dedup — canonical match (deterministic key → title fallback + hard-fact confirm)
      const facts = normalizeFacts({ title, body: `${desc} ${body}`, sourceUrl: link || feed.url, sourceName: feed.name, sourcePriority: feed.priority || 2, sourceType: feed.type });
      const match = findCanonical(facts, [...posts, ...drafts]);
      if (match) {
        const rec = match.record;
        if (rec.status === 'ai-generated' || rec.status === 'under-review') {
          // §18: त्याच draft मध्येच merge — नवीन duplicate article नाही (§27)
          applyFacts(rec, facts, feed);
          console.log(`  MERGED → ${match.method}: ${rec.id}`);
        } else {
          // §18 + §23: published record कधीच auto-edit नाही — update candidate review queue मध्ये
          updateQueue.push({ id: rec.id, title: rec.title, confidence: rec.confidence ?? 0, addedAt: new Date().toISOString(), update: `source-detected: ${feed.name}` });
          console.log(`  UPDATE-DETECTED → review-queue: ${rec.id}`);
        }
        existingTitles.add(normTitle(title));
        if (link) existingLinks.add(link);
        continue;
      }

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

if (drafts.length || updateQueue.length) {
  // Drafts → data/posts (status: ai-generated → generator render करणार नाही)
  for (const d of drafts) writeJson(`data/posts/${d.id}.json`, d);
  // Review queue (+ §18 update candidates)
  const queuePath = 'data/review-queue.json';
  const queue = fs.existsSync(path.join(root, queuePath)) ? read(queuePath) : [];
  queue.push(...drafts.map(d => ({ id: d.id, title: d.title, confidence: d.confidence, addedAt: d.lastUpdatedAt })));
  queue.push(...updateQueue);
  writeJson(queuePath, queue);
  console.log(`\nmonitor.mjs: ${drafts.length} draft(s) + ${updateQueue.length} update-candidate(s) — review-queue मध्ये पाठवले (human approval हवी)`);
} else {
  console.log('\nmonitor.mjs: कोणती नवीन notification नाही');
}

