// Validator — V2: garbage checks, required fields, contentHash (SHA-256), confidence tier enforcement
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'data', 'posts');
const GARBAGE = ['System.Xml', 'XmlElement', 'undefined', 'NaN', '[object Object]'];

// docs/04-AUTOMATION-DESIGN.md §2 — stable-JSON payload, compact
function computeHash(rec) {
  const payload = { title: rec.title, content: rec.content, recruitment: rec.recruitment ?? null, dates: rec.dates ?? null, links: rec.links ?? null };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

let ok = 0, flagged = 0, hashChanged = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const fp = path.join(dir, f);
  let rec;
  try { rec = JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch (e) { console.error(`  [INVALID JSON] ${f}: ${e.message}`); continue; }

  const issues = [];
  // Garbage strings — जुन्या bug सारखी content कधीच जाऊ नये
  const flat = JSON.stringify(rec);
  for (const g of GARBAGE) if (flat.includes(g)) issues.push(`garbage string: ${g}`);
  // Required fields (Schema V2 base)
  if (!rec.title || rec.title.length < 10) issues.push('title missing/too short');
  if (!rec.path || !rec.path.startsWith('/')) issues.push('path invalid');
  if (rec.slug && rec.slug.includes('/')) issues.push('slug must be bare segment');
  if (!rec.content || !rec.content.shortDesc || rec.content.shortDesc.length < 40) issues.push('shortDesc missing/too short');
  // Links must be http(s)
  for (const [k, v] of Object.entries(rec.links || {})) {
    if (v && !/^https?:\/\//.test(v)) issues.push(`links.${k} not http(s)`);
  }
  // Dates sanity
  for (const [k, v] of Object.entries(rec.dates || {})) {
    if (v && !/^\d{4}-\d{2}-\d{2}/.test(v)) issues.push(`dates.${k} not ISO date`);
  }
  // Enum checks
  const UPDATE_TYPES = ['notification', 'application-extended', 'admit-card', 'exam-date', 'answer-key', 'result', 'correction', 'other'];
  for (const u of rec.updates || []) if (u.type && !UPDATE_TYPES.includes(u.type)) issues.push(`updates[].type invalid: ${u.type}`);
  const SOURCE_ROLES = ['notification', 'notification-pdf', 'apply', 'result', 'answer-key', 'admit-card', 'syllabus', 'reference'];
  for (const s of rec.sources || []) if (s.role && !SOURCE_ROLES.includes(s.role)) issues.push(`sources[].role invalid: ${s.role}`);

  // Type-specific checks
  if (rec.type === 'syllabus' && (!rec.syllabus || !Array.isArray(rec.syllabus.subjects) || !rec.syllabus.subjects.length)) {
    issues.push('syllabus record: syllabus.subjects missing/empty');
  }
  if (rec.syllabusRef && rec.syllabusRef !== null && !/^\/[a-z0-9\-\/]+\/$/.test(rec.syllabusRef)) {
    issues.push('syllabusRef not a valid path');
  }

  // contentHash — detect content drift (docs/04 §2)
  const newHash = computeHash(rec);
  if (rec.contentHash && rec.contentHash !== newHash) {
    hashChanged++;
    issues.push('content changed since last hash (lastUpdatedAt update हवा)');
  }
  rec.contentHash = newHash;

  // Confidence tier enforcement (docs/04 §1)
  const c = rec.confidence ?? 0;
  if (c < 70) {
    issues.push('confidence < 70 — hold');
    if (rec.status === 'published' || rec.status === 'updated') rec.status = 'under-review';
  } else if (c < 85 && (rec.status === 'published' || rec.status === 'updated')) {
    issues.push('confidence 70–84 but status published → force under-review');
    rec.status = 'under-review';
  }

  if (issues.length) {
    flagged++;
    console.log(`  [FLAGGED] ${f}: ${issues.join('; ')} (confidence=${rec.confidence}, status=${rec.status})`);
  } else {
    ok++;
  }
  fs.writeFileSync(fp, JSON.stringify(rec, null, 2) + '\n', 'utf8');
}
console.log(`validate.mjs: ${ok} clean, ${flagged} flagged, ${hashChanged} content-drift detected`);
