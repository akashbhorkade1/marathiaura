// Social publish — newly published articles → 4:5 image + caption → Instagram.
// Order: deploy success → public image URL → container → publish → record media ID.
// Rules: published+indexable फक्त; duplicate नाही; credentials नसतील → safe skip;
// API failure → website unaffected (exit 0, status=failed नोंदवा).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeText } from './lib.mjs';
import { socialEligibility, buildCaption, articleUrl } from './social-lib.mjs';
import { socialSvg } from './social-image.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(root, 'data', 'posts');
const site = JSON.parse(fs.readFileSync(path.join(root, 'data/site.json'), 'utf8')).site;
const SOCIAL_DIR = path.join(root, 'assets', 'social');

const IG_USER_ID = process.env.IG_USER_ID || '';
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN || '';
const GRAPH = (process.env.IG_GRAPH_HOST || 'https://graph.facebook.com').replace(/\/$/, '');
const API_VER = process.env.IG_API_VERSION || 'v23.0';

function loadPosts() {
  return fs.readdirSync(postsDir).filter(f => f.endsWith('.json')).map(f => {
    try { return { file: f, post: JSON.parse(fs.readFileSync(path.join(postsDir, f), 'utf8')) }; } catch { return null; }
  }).filter(Boolean);
}

function saveArtifact(post, caption) {
  fs.mkdirSync(SOCIAL_DIR, { recursive: true });
  const svg = socialSvg(post);
  fs.writeFileSync(path.join(SOCIAL_DIR, `${post.id}.svg`), svg, 'utf8');
  fs.writeFileSync(path.join(SOCIAL_DIR, `${post.id}.caption.txt`), caption, 'utf8');
  return `/assets/social/${post.id}.svg`;
}

async function igCreateContainer(imageUrl, caption) {
  const body = new URLSearchParams({ image_url: imageUrl, caption, access_token: IG_ACCESS_TOKEN });
  const res = await fetch(`${GRAPH}/${API_VER}/${IG_USER_ID}/media`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body, signal: AbortSignal.timeout(60000)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) throw new Error(`container failed: HTTP ${res.status} ${safeText(data.error && data.error.message).slice(0, 200)}`);
  return data.id;
}

async function igPublish(containerId) {
  const body = new URLSearchParams({ creation_id: containerId, access_token: IG_ACCESS_TOKEN });
  const res = await fetch(`${GRAPH}/${API_VER}/${IG_USER_ID}/media_publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body, signal: AbortSignal.timeout(60000)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) throw new Error(`publish failed: HTTP ${res.status} ${safeText(data.error && data.error.message).slice(0, 200)}`);
  return data.id;
}

function markSocial(post, file, patch) {
  if (DRY_RUN) return;
  post.social = post.social || {};
  post.social.instagram = { ...(post.social.instagram || {}), ...patch };
  post.lastUpdatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(postsDir, file), JSON.stringify(post, null, 2) + '\n', 'utf8');
}

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? Math.max(1, parseInt(limitArg.split('=')[1], 10) || 5) : 5;
const onlyId = (process.argv.find(a => a.startsWith('--id=')) || '').split('=')[1] || null;
const DRY_RUN = process.argv.includes('--dry-run');

const creds = IG_USER_ID && IG_ACCESS_TOKEN;
if (!creds) console.log('social-publish.mjs: IG credentials नाहीत — generation-only fallback (image+caption artifacts, API publish skip)');

let done = 0, skipped = 0, failed = 0, generated = 0;
async function main() {
for (const { file, post } of loadPosts()) {
  if (onlyId && post.id !== onlyId) continue;
  const elig = socialEligibility(post);
  if (!elig.eligible) continue;
  if (done >= LIMIT) { skipped++; continue; }
  const caption = buildCaption(post, site.url);
  const relPath = saveArtifact(post, caption);
  generated++;
  console.log(`  ARTIFACT: ${relPath} + caption (${caption.length} chars) ← ${post.id}`);
  if (!creds) {
    markSocial(post, file, { status: 'ready', captionPath: relPath.replace('.svg', '.caption.txt'), imagePath: relPath, updatedAt: new Date().toISOString() });
    done++;
    continue;
  }
  // Deploy order: image आधीच deploy झालेल्या site वर public असावी.
  // Public URL = site.url + relPath. ती verify न करता container बनवू नये.
  const imageUrl = site.url.replace(/\/$/, '') + relPath;
  try {
    const head = await fetch(imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(20000) });
    if (!head.ok) throw new Error(`public image URL not reachable (deploy pending?): HTTP ${head.status}`);
  } catch (e) {
    markSocial(post, file, { status: 'ready', captionPath: relPath.replace('.svg', '.caption.txt'), imagePath: relPath, note: `deploy-pending: ${e.message}`, updatedAt: new Date().toISOString() });
    console.error(`  [READY-not-published] ${post.id}: ${e.message}`);
    done++;
    continue;
  }
  try {
    const containerId = await igCreateContainer(imageUrl, caption);
    const mediaId = await igPublish(containerId);
    markSocial(post, file, { status: 'published', mediaId, containerId, imagePath: relPath, postedAt: new Date().toISOString(), postUrl: articleUrl(post, site.url) });
    console.log(`  PUBLISHED: ${post.id} → media ${mediaId}`);
    done++;
  } catch (e) {
    markSocial(post, file, { status: 'failed', error: String(e.message).slice(0, 300), imagePath: relPath, updatedAt: new Date().toISOString() });
    console.error(`  [FAILED] ${post.id}: ${e.message} (website unaffected)`);
    failed++;
  }
}
console.log(`\nsocial-publish.mjs: ${generated} artifact(s), ${done} processed, ${failed} failed, ${skipped} over-limit skipped (website unaffected)`);
}

await main();
