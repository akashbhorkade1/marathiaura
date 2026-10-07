// Monthly Current Affairs — weekly roundups/source records → consolidated monthly revision draft.
// Copy-paste compilation नाही: dedup → importance ranking → category organization.
// Thin month → NO article. draft → review queue → HUMAN approval.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeText } from './lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(root, 'data', 'posts');
const queuePath = path.join(root, 'data', 'review-queue.json');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n', 'utf8');

export const MIN_MONTHLY_ITEMS = 5;
const DEV_RE = /(भरती|भर्ती|recruitment|vacanc\w*|जागांसाठी भरती|vacancies)/i;
const MR_MONTH = { '01': 'जानेवारी', '02': 'फेब्रुवारी', '03': 'मार्च', '04': 'एप्रिल', '05': 'मे', '06': 'जून', '07': 'जुलै', '08': 'ऑगस्ट', '09': 'सप्टेंबर', '10': 'ऑक्टोबर', '11': 'नोव्हेंबर', '12': 'डिसेंबर' };

function loadPosts() {
  return fs.readdirSync(postsDir).filter(f => f.endsWith('.json')).map(f => {
    try { return JSON.parse(fs.readFileSync(path.join(postsDir, f), 'utf8')); } catch { return null; }
  }).filter(Boolean);
}
function meaningfulCA(p, month) {
  if (!p || p.type !== 'current-affairs') return false;
  if (p.kind === 'monthly') return false;
  const text = `${p.title || ''} ${(p.content && p.content.shortDesc) || ''}`;
  if (text.length < 30) return false;
  if (DEV_RE.test(text)) return false;
  if (p.recruitment && Number.isFinite(p.recruitment.vacancies)) return false;
  const d = p.kind === 'weekly' && p.period ? p.period.start : (p.date || (p.lastUpdatedAt || '').slice(0, 10) || '');
  return d.slice(0, 7) === month;
}
export function collectMonthly(month) {
  const seen = new Set(); const out = [];
  const items = loadPosts().filter(p => meaningfulCA(p, month));
  // importance ranking: weekly roundup प्रथम, नंतर detailed records (desc length).
  items.sort((a, b) => {
    const aw = a.kind === 'weekly' ? 0 : 1; const bw = b.kind === 'weekly' ? 0 : 1;
    if (aw !== bw) return aw - bw;
    return String((b.content && b.content.shortDesc) || '').length - String((a.content && a.content.shortDesc) || '').length;
  });
  for (const p of items) {
    const key = safeText(p.title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key); out.push(p);
  }
  return out;
}

export function buildMonthlyDraft(items, month) {
  const id = `current-affairs-monthly-${month}`;
  const [y, m] = month.split('-');
  const title = `${MR_MONTH[m]} ${y} चालू घडामोडी — मासिक आढावा`;
  const sections = items.slice(0, 30).map((p, i) => ({
    heading: safeText(p.title).slice(0, 80) || `घडामोड ${i + 1}`,
    type: 'text',
    body: safeText(p.content && p.content.shortDesc).slice(0, 500) || safeText(p.title).slice(0, 300)
  }));
  const now = new Date().toISOString();
  return {
    id, type: 'current-affairs', kind: 'monthly', period: { month },
    title, slug: id, path: `/current-affairs/${id.replace(/^current-affairs-/, '')}/`,
    category: 'current-affairs', exam: null, department: 'MarathiAura Current Affairs Desk',
    recruitment: { postNames: [], vacancies: null, vacanciesNote: null, qualification: [], ageLimit: null, salary: null, fee: null, applicationMode: null, location: null, jobType: null },
    dates: { notification: null, applicationStart: null, applicationEnd: null, examDate: null, admitCardDate: null, resultDate: null },
    links: { notificationUrl: null, applyUrl: null, officialUrl: null },
    selectionProcess: [], syllabusRef: null, relatedMockTests: [],
    content: { shortDesc: `${MR_MONTH[m]} ${y} महिन्यातील महत्त्वाच्या चालू घडामोडींचा एकत्रित मासिक आढावा — उजळणीसाठी उपयुक्त.`.slice(0, 300), metaDescription: null, sections, faqs: [] },
    sources: items.slice(0, 30).map(p => ({ url: (p.sources && p.sources[0] && p.sources[0].url) || null, name: (p.sources && p.sources[0] && p.sources[0].name) || p.department || 'Source', priority: 3, role: 'reference', verifiedAt: null })).filter(s => s.url),
    provenance: { sourceName: 'MarathiAura monthly aggregation', sourceUrl: null, sourceType: 'monthly-roundup', officialUrl: null, officialNotificationUrl: null, retrievedAt: now, verifiedAt: null, confidence: 85, contentHash: null, copySimilarity: 0, flags: [] },
    status: 'ai-generated', confidence: 85, publishedAt: null, lastUpdatedAt: now, contentHash: null, updates: [],
    seo: { keywords: [title, 'चालू घडामोडी', 'MarathiAura'], ogImage: `/og-images/${id}.svg`, index: false }
  };
}

const isMain = (() => { try { return process.argv[1] && path.resolve(process.argv[1]) === path.join(root, 'automation', 'ca-monthly.mjs'); } catch { return false; } })();
if (isMain && !process.env.NODE_TEST_CONTEXT && !process.argv.includes('--test')) {
  const month = (process.argv[2] || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(new Date())).slice(0, 7);
  if (fs.existsSync(path.join(postsDir, `current-affairs-monthly-${month}.json`))) {
    console.log(`ca-monthly.mjs: monthly draft already exists for ${month} — skip`);
    process.exit(0);
  }
  const items = collectMonthly(month);
  console.log(`ca-monthly.mjs: ${items.length} ranked CA record(s) in ${month}`);
  if (items.length < MIN_MONTHLY_ITEMS) {
    console.log(`ca-monthly.mjs: < ${MIN_MONTHLY_ITEMS} verified developments → NO monthly article (filler नाही)`);
    process.exit(0);
  }
  const draft = buildMonthlyDraft(items, month);
  writeJson(path.join(postsDir, `${draft.id}.json`), draft);
  const queue = fs.existsSync(queuePath) ? read(queuePath) : [];
  queue.push({ id: draft.id, title: draft.title, confidence: draft.confidence, addedAt: draft.lastUpdatedAt });
  writeJson(queuePath, queue);
  console.log(`ca-monthly.mjs: monthly draft → ${draft.id} (review queue; human approval हवी)`);
}
