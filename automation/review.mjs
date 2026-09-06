// Review CLI — review-queue वर human action (docs/04 §4)
// Usage:
//   node automation/review.mjs                → queue list
//   node automation/review.mjs approve <id>  → status: published (confidence ≥ 85 आवश्यक)
//   node automation/review.mjs reject <id>   → status: archived (कधीच render होणार नाही)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const queuePath = path.join(root, 'data/review-queue.json');
const postPath = pid => path.join(root, 'data/posts', `${pid}.json`);
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n', 'utf8');

const [cmd, id] = process.argv.slice(2);
const queue = fs.existsSync(queuePath) ? read(queuePath) : [];

if (!cmd || cmd === 'list') {
  if (!queue.length) { console.log('review-queue रिकामा आहे ✓'); process.exit(0); }
  const now = Date.now();
  console.log(`Review queue: ${queue.length} item(s)\n`);
  for (const q of queue) {
    const ageDays = Math.floor((now - new Date(q.addedAt).getTime()) / 86400000);
    console.log(`- [${q.id}] confidence ${q.confidence} · ${ageDays} दिवस जुना`);
    console.log(`  ${q.title}`);
  }
  console.log('\nApprove: node automation/review.mjs approve <id>');
  console.log('Reject:  node automation/review.mjs reject <id>');
  console.log('\nनोंद: 14 दिवसांहून जुन्या drafts कधीच live जाऊ नयेत (docs/04 §4) — त्यांना reject करा किंवा दुरुस्त करा.');
} else if (cmd === 'approve' || cmd === 'reject') {
  if (!id) { console.error(`Usage: node automation/review.mjs ${cmd} <id>`); process.exit(1); }
  const qIdx = queue.findIndex(q => q.id === id);
  const exists = fs.existsSync(postPath(id));
  if (qIdx === -1 && !exists) { console.error(`'${id}' queue मध्ये आणि data/posts मध्येही सापडला नाही`); process.exit(1); }
  const record = exists ? read(postPath(id)) : null;
  const now = new Date().toISOString();

  if (cmd === 'approve') {
    // docs/04 §1: publish होण्यासाठी status published **आणि** confidence ≥ 85 दोन्ही आवश्यक
    if (record && (record.confidence ?? 0) < 85) {
      console.error(`✗ confidence ${record.confidence} < 85 — approve शक्य नाही. आधी fields भरा (docs/04 §1 factor table)`);
      process.exit(1);
    }
    if (record) {
      record.status = 'published';
      record.publishedAt = record.publishedAt || now;
      record.lastUpdatedAt = now;
      writeJson(postPath(id), record);
    }
    console.log(`✓ '${id}' published`);
    console.log('  पुढे: node automation/build.mjs — त्यानंतरच site वर render होईल');
  } else {
    if (record) {
      record.status = 'archived';
      record.lastUpdatedAt = now;
      writeJson(postPath(id), record);
    }
    console.log(`✓ '${id}' archived — generator कधीच render करणार नाही (docs/04 §1)`);
  }

  if (qIdx !== -1) { queue.splice(qIdx, 1); writeJson(queuePath, queue); }
  console.log(`review-queue: ${queue.length} item(s) उरले`);
} else {
  console.error(`Unknown command '${cmd}'. वापरा: list | approve <id> | reject <id>`);
  process.exit(1);
}
