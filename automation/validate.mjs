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

// ===== Question Bank + Mock Test integrity (Step 2) =====
const bankDir = path.join(root, 'data', 'questions');
const testDir = path.join(root, 'data', 'mock-tests');
const examsDir = path.join(root, 'data', 'exams');

// Collect topicIds (exam → topicId set)
const topicByExam = {};
for (const f of fs.readdirSync(dir).filter(f => f.startsWith('syllabus-'))) {
  const rec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const topics = new Set();
  for (const sub of (rec.syllabus?.subjects || [])) for (const t of (sub.topics || [])) if (t.topicId) topics.add(t.topicId);
  topicByExam[rec.exam] = topics;
}
const examIds = new Set(fs.readdirSync(examsDir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(examsDir, f), 'utf8')).id));

const qids = new Set();
const qById = new Map();
let qBank = 0, qErr = 0, mTest = 0;

for (const f of fs.readdirSync(bankDir).filter(f => f.endsWith('.json'))) {
  const b = JSON.parse(fs.readFileSync(path.join(bankDir, f), 'utf8'));
  const topics = topicByExam[b.exam] || new Set();
  if (b.exam && !examIds.has(b.exam)) { console.log(`  [QBANK] ${f}: exam '${b.exam}' not in data/exams`); qErr++; }
  for (const q of (b.questions || [])) {
    qBank++;
    const qIssues = [];
    const flat = JSON.stringify(q);
    for (const g of GARBAGE) if (flat.includes(g)) qIssues.push(`garbage: ${g}`);
    if (!q.id) qIssues.push('missing id');
    else if (qids.has(q.id)) qIssues.push(`duplicate id ${q.id}`);
    if (q.id) qids.add(q.id);
    if (!q.question || q.question.length < 10) qIssues.push('missing/too-short question');
    if (!Array.isArray(q.options) || q.options.length < 2) qIssues.push('options must be array (>=2)');
    else {
      const ids = q.options.map(o => o.id);
      if (new Set(ids).size !== ids.length) qIssues.push('duplicate option ids');
      if (!ids.includes(q.correctAnswer)) qIssues.push(`correctAnswer '${q.correctAnswer}' not in options`);
    }
    if (!q.explanation) qIssues.push('missing explanation');
    if (!q.subjectId) qIssues.push('missing subjectId');
    if (!q.topicId) qIssues.push('missing topicId');
    else if (topics.size && !topics.has(q.topicId)) qIssues.push(`topicId '${q.topicId}' not in syllabus (${b.exam})`);
    if (q.difficulty && !['easy', 'medium', 'hard'].includes(q.difficulty)) qIssues.push(`difficulty '${q.difficulty}' invalid`);
    // (no-op placeholder removed)

    if (qIssues.length) { qErr++; console.log(`  [QBANK] ${f} ${q.id || '(no id)'}: ${qIssues.join('; ')}`); }
    else qById.set(q.id, q);
  }
}

if (fs.existsSync(testDir)) {
for (const f of fs.readdirSync(testDir).filter(f => f.endsWith('.json'))) {
  mTest++;
  const t = JSON.parse(fs.readFileSync(path.join(testDir, f), 'utf8'));
  const tIssues = [];
  if (!t.questionIds || !t.questionIds.length) tIssues.push('missing questionIds');
  else {
    for (const id of t.questionIds) if (!qById.has(id)) tIssues.push(`unresolved questionId '${id}'`);
  }
  if (t.exam && !examIds.has(t.exam)) tIssues.push(`exam '${t.exam}' not in data/exams`);
  if (tIssues.length) { qErr++; console.log(`  [MTEST] ${f}: ${tIssues.join('; ')}`); }
}
}

console.log(`validate.mjs: ${ok} posts clean · ${flagged} posts flagged · ${hashChanged} drift · bank ${qBank} (${qErr} errors) · mock-tests ${mTest}`);
