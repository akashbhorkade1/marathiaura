// Validator — प्रत्येक record वर quality checks; confidence adjust; report
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'data', 'posts');
const GARBAGE = ['System.Xml', 'XmlElement', 'undefined', 'NaN', '[object Object]'];

let ok = 0, flagged = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const p = path.join(dir, f);
  let rec;
  try { rec = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { console.error(`  [INVALID JSON] ${f}: ${e.message}`); continue; }

  const issues = [];
  // Garbage strings — जुन्या bug सारखी content कधीच जाऊ नये
  const flat = JSON.stringify(rec);
  for (const g of GARBAGE) if (flat.includes(g)) issues.push(`garbage string: ${g}`);
  // Required fields
  if (!rec.title || rec.title.length < 10) issues.push('title missing/too short');
  if (!rec.slug || !rec.slug.startsWith('/')) issues.push('slug invalid');
  if (!rec.content || !rec.content.shortDesc || rec.content.shortDesc.length < 40) issues.push('shortDesc missing/too short');
  // Links must be http(s)
  for (const [k, v] of Object.entries(rec.links || {})) {
    if (v && !/^https?:\/\//.test(v)) issues.push(`links.${k} not http(s)`);
  }
  // Dates sanity
  for (const [k, v] of Object.entries(rec.dates || {})) {
    if (v && !/^\d{4}-\d{2}-\d{2}/.test(v)) issues.push(`dates.${k} not ISO date`);
  }
  // Confidence adjustments
  if (!rec.links || !rec.links.notificationUrl) rec.confidence = Math.max(0, (rec.confidence ?? 100) - 5);
  if (!rec.recruitment || rec.recruitment.vacancies == null) rec.confidence = Math.max(0, (rec.confidence ?? 100) - 0); // null ठीक आहे, guess नाही

  if (issues.length) {
    flagged++;
    console.log(`  [FLAGGED] ${f}: ${issues.join('; ')} (confidence=${rec.confidence})`);
    // <80% confidence → generator render करणारच नाही (status workflow मध्येच पकडले जाते)
  } else {
    ok++;
  }
  fs.writeFileSync(p, JSON.stringify(rec, null, 2) + '\n', 'utf8');
}
console.log(`validate.mjs: ${ok} clean, ${flagged} flagged`);
