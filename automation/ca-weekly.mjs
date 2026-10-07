// Weekly Current Affairs aggregator — daily collection → ONE weekly roundup draft.
// daily publishing बंद; weekly हेच primary format. <3 developments → NO article.
// draft → review queue → HUMAN approval. Auto-publish नाही.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeText } from './lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(root, 'data', 'posts');
const queuePath = path.join(root, 'data', 'review-queue.json');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n', 'utf8');

export const MIN_WEEKLY_ITEMS = 3;
const DEV_RE = /(भरती|भर्ती|recruitment|vacanc\w*|जागांसाठी भरती|vacancies)/i;

function istWeekRange(startIso, endIso) {
  if (startIso && endIso) return { start: startIso.slice(0, 10), end: endIso.slice(0, 10) };
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const diffToMon = (ist.getDay() + 6) % 7;
  const mon = new Date(ist); mon.setDate(ist.getDate() - diffToMon);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const f = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: f(mon), end: f(sun) };
}
const MR_MONTH = { '01': 'जानेवारी', '02': 'फेब्रुवारी', '03': 'मार्च', '04': 'एप्रिल', '05': 'मे', '06': 'जून', '07': 'जुलै', '08': 'ऑगस्ट', '09': 'सप्टेंबर', '10': 'ऑक्टोबर', '11': 'नोव्हेंबर', '12': 'डिसेंबर' };
const mrRange = (s, e) => `${+s.slice(8, 10)} ${MR_MONTH[s.slice(5, 7)]} ${s.slice(0, 4)} ते ${+e.slice(8, 10)} ${MR_MONTH[e.slice(5, 7)]} ${e.slice(0, 4)}`;

function loadPosts() {
  return fs.readdirSync(postsDir).filter(f => f.endsWith('.json')).map(f => {
    try { return JSON.parse(fs.readFileSync(path.join(postsDir, f), 'utf8')); } catch { return null; }
  }).filter(Boolean);
}
function meaningfulCA(p) {
  if (!p || p.type !== 'current-affairs') return false;
  if (p.kind === 'weekly' || p.kind === 'monthly') return false;
  const text = `${p.title || ''} ${(p.content && p.content.shortDesc) || ''}`;
  if (text.length < 30) return false;
  if (DEV_RE.test(text)) return false;
  if (p.recruitment && Number.isFinite(p.recruitment.vacancies)) return false;
  return true;
}
export function collectWeekly({ start, end } = {}) {
  const seen = new Set(); const out = [];
  const items = loadPosts().filter(p => {
    if (!meaningfulCA(p)) return false;
    const d = (p.date || (p.lastUpdatedAt || '').slice(0, 10) || '');
    return d >= start && d <= end;
  }).sort((a, b) => String(a.lastUpdatedAt || '').localeCompare(String(b.lastUpdatedAt || '')));
  for (const p of items) {
    const key = safeText(p.title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key); out.push(p);
  }
  return out;
}

export function buildWeeklyDraft(items, { start, end }) {
  const periodMr = mrRange(start, end);
  const id = `current-affairs-weekly-${start}-to-${end}`;
  const sections = items.slice(0, 25).map((p, i) => ({
    heading: safeText(p.title).slice(0, 80) || `घडामोड ${i + 1}`,
    type: 'text',
    body: safeText(p.content && p.content.shortDesc).slice(0, 500) || safeText(p.title).slice(0, 300)
  }));
  const now = new Date().toISOString();
  return {
    id, type: 'current-affairs', kind: 'weekly',
    period: { start, end },
    title: `चालू घडामोडी : ${periodMr} — साप्ताहिक आढावा`,
    slug: id, path: `/current-affairs/${id.replace(/^current-affairs-/, '')}/`,
    category: 'current-affairs', exam: null, department: 'MarathiAura Current Affairs Desk',
    recruitment: { postNames: [], vacancies: null, vacanciesNote: null, qualification: [], ageLimit: null, salary: null, fee: null, applicationMode: null, location: null, jobType: null },
    dates: { notification: null, applicationStart: null, applicationEnd: null, examDate: null, admitCardDate: null, resultDate: null },
    links: { notificationUrl: null, applyUrl: null, officialUrl: null },
    selectionProcess: [], syllabusRef: null, relatedMockTests: [],
    content: { shortDesc: `${periodMr} या आठवड्यातील महत्त्वाच्या चालू घडामोडींचा एकत्रित आढावा — स्पर्धा परीक्षांसाठी उपयुक्त.`.slice(0, 300), metaDescription: null, sections, faqs: [] },
    sources: items.slice(0, 25).map(p => ({ url: (p.sources && p.sources[0] && p.sources[0].url) || null, name: (p.sources && p.sources[0] && p.sources[0].name) || p.department || 'Source', priority: 3, role: 'reference', verifiedAt: null })).filter(s => s.url),
    provenance: { sourceName: 'MarathiAura weekly aggregation', sourceUrl: null, sourceType: 'weekly-roundup', officialUrl: null, officialNotificationUrl: null, retrievedAt: now, verifiedAt: null, confidence: 85, contentHash: null, copySimilarity: 0, flags: [] },
    status: 'ai-generated', confidence: 85, publishedAt: null, lastUpdatedAt: now, contentHash: null, updates: [],
    seo: { keywords: [`चालू घडामोडी ${periodMr}`, 'चालू घडामोडी', 'MarathiAura'], ogImage: `/og-images/${id}.svg`, index: false }
  };
}

const isMain = (() => { try { return process.argv[1] && path.resolve(process.argv[1]) === path.join(root, 'automation', 'ca-weekly.mjs'); } catch { return false; } })();
if (isMain && !process.env.NODE_TEST_CONTEXT && !process.argv.includes('--test')) {
  const { start, end } = istWeekRange(process.argv[2], process.argv[3]);
  if (fs.existsSync(path.join(postsDir, `current-affairs-weekly-${start}-to-${end}.json`))) {
    console.log(`ca-weekly.mjs: weekly draft already exists for ${start}..${end} — skip`);
    process.exit(0);
  }
  const items = collectWeekly({ start, end });
  console.log(`ca-weekly.mjs: ${items.length} meaningful CA record(s) in ${start}..${end}`);
  if (items.length < MIN_WEEKLY_ITEMS) {
    console.log(`ca-weekly.mjs: < ${MIN_WEEKLY_ITEMS} verified developments → NO weekly article (filler नाही)`);
    process.exit(0);
  }
  const draft = buildWeeklyDraft(items, { start, end });
  writeJson(path.join(postsDir, `${draft.id}.json`), draft);
  const queue = fs.existsSync(queuePath) ? read(queuePath) : [];
  queue.push({ id: draft.id, title: draft.title, confidence: draft.confidence, addedAt: draft.lastUpdatedAt });
  writeJson(queuePath, queue);
  console.log(`ca-weekly.mjs: weekly draft → ${draft.id} (review queue; human approval हवी)`);
}
