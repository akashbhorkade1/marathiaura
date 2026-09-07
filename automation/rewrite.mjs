// AI Rewrite — review-queue मधील rewritePending drafts ला AI द्वारे Marathi rewrite (docs/04 §6)
// OpenAI-compatible endpoint — Gemini free tier (default) किंवा कोणताही OpenAI-style API.
// Env: AI_API_KEY (आवश्यक; नसेल हे script safe skip करते), AI_BASE_URL, AI_MODEL
// नियम (frozen): AI कधीच facts invent करू शकत नाही — dates/संख्या/links source प्रमाणेच; output नेहमी Marathi.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const queuePath = path.join(root, 'data/review-queue.json');
const postPath = pid => path.join(root, 'data/posts', `${pid}.json`);
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n', 'utf8');

const API_KEY = process.env.AI_API_KEY;
const BASE_URL = (process.env.AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/$/, '');
const MODELS = [process.env.AI_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash'].filter(Boolean); // fallback chain
const MAX_REWRITES = 10; // free tier rate limits — प्रति धाव cap (docs/04 §6)

if (!API_KEY) {
  console.log('rewrite.mjs: AI_API_KEY नाही — skip (template drafts तसेच राहतील, pipeline unblocked)');
  process.exit(0);
}

const SYSTEM_PROMPT = [
  'तुम्ही MarathiAura (मराठी स्पर्धा परीक्षा website) साठी content rewriter आहात.',
  'काम: दिलेला draft (title/shortDesc/sections) सुसंगत, स्वच्छ **मराठीत** rewrite करणे.',
  'कडक नियम:',
  '1. कोणतीही नवीन fact/rakam/tarikh invent करू नका — source मधील dates, संख्या, पदे, शुल्क, URLs जसेच्या तस्या ठेवा.',
  '2. Source मध्ये नसलेली माहिती मागायची नाही; अनिश्चित गोष्टी वगळा.',
  '3. Output फक्त valid JSON: {"title": str, "shortDesc": str, "sections": [{"heading": str, "body": str}]}',
  '4. sections: जास्तीत जास्त 3, प्रत्येक body 600 अक्षरांपर्यात. शीर्षके माहितीपर, clickbait नाही.',
  '5. मूळ JSON च्या क्रमानेच परत करा; कोणतेही extra fields नाहीत.'
].join('\n');

async function callAI(payload) {
  let lastErr;
  for (const model of MODELS) {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify(payload) }],
          temperature: 0.3
        }),
        signal: AbortSignal.timeout(60000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} (${model})`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('response मध्ये JSON नाही');
      return JSON.parse(m[0]);
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

const queue = fs.existsSync(queuePath) ? read(queuePath) : [];
const pending = queue.filter(q => {
  const p = fs.existsSync(postPath(q.id)) ? read(postPath(q.id)) : null;
  return p && p.rewritePending === true && p.status === 'ai-generated';
}).slice(0, MAX_REWRITES);

if (!pending.length) { console.log('rewrite.mjs: rewrite होण्यासारखे drafts नाहीत'); process.exit(0); }
console.log(`rewrite.mjs: ${pending.length} draft(s) AI-rewrite साठी (model chain: ${MODELS.join(' -> ')})`);

let done = 0, failed = 0;
for (const q of pending) {
  const post = read(postPath(q.id));
  try {
    const out = await callAI({
      title: post.title,
      shortDesc: post.content.shortDesc,
      sections: post.content.sections.map(s => ({ heading: s.heading, body: s.body }))
    });
    if (!out.title || !Array.isArray(out.sections) || !out.sections.length) throw new Error('AI output अपूर्ण');
    const now = new Date().toISOString();
    post.title = String(out.title).slice(0, 160);
    post.content.shortDesc = String(out.shortDesc || post.content.shortDesc).slice(0, 300);
    post.content.sections = out.sections.slice(0, 3).map(s => ({ heading: String(s.heading || 'माहिती').slice(0, 80), type: 'text', body: String(s.body || '').slice(0, 600) }));
    post.aiRewritten = true;          // docs/04 §1: AI-generated unreviewed → confidence bump नाही
    post.aiRewrittenAt = now;
    post.lastUpdatedAt = now;
    delete post.rewritePending;
    writeJson(postPath(q.id), post);
    const qi = queue.findIndex(x => x.id === q.id);
    if (qi !== -1) { queue[qi].title = post.title; writeJson(queuePath, queue); }
    done++;
    console.log(`  OK [${q.id}] ${post.title}`);
  } catch (e) {
    failed++;
    // silent fallback: template draft तसाच राहतो — pipeline कधीच block नाही
    console.error(`  [SKIP] ${q.id}: ${e.message}`);
  }
}
console.log(`\nrewrite.mjs: ${done} rewritten, ${failed} skipped (template fallback)`);
