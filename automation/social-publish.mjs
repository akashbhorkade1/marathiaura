// Social publish — दोन फेज:
//   Phase A (--phase=generate): eligible articles साठी JPEG image + caption तयार करा, status='ready' नोंदवा, commit/push करा. Instagram API कॉल नको.
//   Phase B (--phase=publish): deploy यशस्वी झाल्यानंतर pending posts publish करा, media ID जतन करा.
// Order: deploy success → public image URL (JPEG) verify → container → publish → record media ID.
// Rules: published+indexable फक्त; duplicate नाही (status='published' → skip); credentials नसतील → safe skip;
// API failure → website unaffected, status='failed' नोंदवा, Phase B मध्ये job fail करा (मिसलीडिंग green success नको).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeText } from './lib.mjs';
import { socialEligibility, buildCaption, articleUrl } from './social-lib.mjs';
import { socialSvg, socialJpeg, isValidJpeg } from './social-image.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(root, 'data', 'posts');
const site = JSON.parse(fs.readFileSync(path.join(root, 'data/site.json'), 'utf8')).site;
const SOCIAL_DIR = path.join(root, 'assets', 'social');

const IG_USER_ID = process.env.IG_USER_ID || '';
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN || '';
const GRAPH = (process.env.IG_GRAPH_HOST || 'https://graph.instagram.com').replace(/\/$/, '');
const API_VER = process.env.IG_API_VERSION || 'v23.0';

function loadPosts() {
  return fs.readdirSync(postsDir).filter(f => f.endsWith('.json')).map(f => {
    try { return { file: f, post: JSON.parse(fs.readFileSync(path.join(postsDir, f), 'utf8')) }; } catch { return null; }
  }).filter(Boolean);
}

// Phase A artifact: वैध JPEG (.jpg) + caption. SVG नाही.
function saveArtifact(post, caption) {
  fs.mkdirSync(SOCIAL_DIR, { recursive: true });
  const jpgBuf = socialJpeg(post); // throws if not valid JPEG
  fs.writeFileSync(path.join(SOCIAL_DIR, `${post.id}.jpg`), jpgBuf);
  fs.writeFileSync(path.join(SOCIAL_DIR, `${post.id}.caption.txt`), caption, 'utf8');
  return `/assets/social/${post.id}.jpg`;
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

const phaseArg = process.argv.find(a => a.startsWith('--phase='));
const PHASE = phaseArg ? phaseArg.split('=')[1] : 'generate';
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? Math.max(1, parseInt(limitArg.split('=')[1], 10) || 5) : 5;
const onlyId = (process.argv.find(a => a.startsWith('--id=')) || '').split('=')[1] || null;
const DRY_RUN = process.argv.includes('--dry-run');

if (PHASE !== 'generate' && PHASE !== 'publish') {
  console.error(`Invalid --phase=${PHASE}. Use 'generate' or 'publish'.`);
  process.exit(2);
}

const creds = IG_USER_ID && IG_ACCESS_TOKEN;
if (!creds) console.log('social-publish.mjs: IG credentials नाहीत — generation-only fallback (image+caption artifacts, API publish skip)');

let done = 0, skipped = 0, failed = 0, generated = 0, hadApiFailure = false;
async function main() {
  for (const { file, post } of loadPosts()) {
    if (onlyId && post.id !== onlyId) continue;

    // Phase A: generate artifacts for eligible posts (incl. 'ready' stuck posts, excl. 'published')
    if (PHASE === 'generate') {
      const elig = socialEligibility(post);
      if (!elig.eligible) continue;
      if (done >= LIMIT) { skipped++; continue; }
      const caption = buildCaption(post, site.url);
      const relPath = saveArtifact(post, caption);
      generated++;
      console.log(`  ARTIFACT: ${relPath} + caption (${caption.length} chars) ← ${post.id}`);
      markSocial(post, file, { status: 'ready', captionPath: relPath.replace('.jpg', '.caption.txt'), imagePath: relPath, updatedAt: new Date().toISOString() });
      done++;
      continue;
    }

    // Phase B: publish only posts stuck in 'ready' (deploy-pending) or 'failed' (retry), that are eligible
    if (PHASE === 'publish') {
      const st = post.social && post.social.instagram && post.social.instagram;
      const status = st ? st.status : null;
      if (status !== 'ready' && status !== 'failed') continue; // only pending/retry
      // Retry limit: stop retrying after 3 failed attempts to prevent infinite loops.
      const attemptCount = st && Number.isFinite(st.attemptCount) ? st.attemptCount : 0;
      if (attemptCount >= 3) {
        console.log(`  SKIP-max-attempts: ${post.id} (attemptCount=${attemptCount})`);
        continue;
      }
      const elig = socialEligibility(post);
      if (!elig.eligible) {
        console.log(`  SKIP-not-eligible: ${post.id} (${elig.reason})`);
        continue;
      }
      if (done >= LIMIT) { skipped++; continue; }

      const caption = buildCaption(post, site.url);
      const relPath = `/assets/social/${post.id}.jpg`;
      const imageUrl = site.url.replace(/\/$/, '') + relPath;

      // Deploy-पुढचि: public image URL वैध JPEG आहे का verify करा.
      let jpegOk = false;
      try {
        const head = await fetch(imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(20000) });
        const ct = head.headers.get('content-type') || '';
        if (head.ok && /^image\/jpeg/i.test(ct)) {
          jpegOk = true;
        } else {
          throw new Error(`public image not JPEG (HTTP ${head.status}, content-type=${ct})`);
        }
      } catch (e) {
        markSocial(post, file, { status: 'failed', error: `deploy-pending: ${e.message}`, imagePath: relPath, updatedAt: new Date().toISOString() });
        console.error(`  [READY-not-published] ${post.id}: ${e.message}`);
        done++;
        continue;
      }

      if (!jpegOk) {
        markSocial(post, file, { status: 'failed', error: 'public image URL is not image/jpeg', imagePath: relPath, updatedAt: new Date().toISOString() });
        console.error(`  [FAILED] ${post.id}: public image URL is not image/jpeg`);
        failed++;
        hadApiFailure = true;
        continue;
      }

      try {
        const existingMediaId = post.social && post.social.instagram && post.social.instagram.mediaId;
        if (existingMediaId) {
          // Publish already succeeded on Instagram but earlier status commit failed (idempotent recovery).
          // Do NOT call the API again — just reconcile local status to 'published'.
          markSocial(post, file, { status: 'published', mediaId: existingMediaId, imagePath: relPath, postedAt: new Date().toISOString(), postUrl: articleUrl(post, site.url), recovered: true });
          console.log(`  RECOVERED: ${post.id} → media ${existingMediaId} (publish succeeded earlier, status commit failed)`);
          done++;
          continue;
        }
        const containerId = await igCreateContainer(imageUrl, caption);
        const mediaId = await igPublish(containerId);
        markSocial(post, file, { status: 'published', mediaId, containerId, imagePath: relPath, postedAt: new Date().toISOString(), postUrl: articleUrl(post, site.url) });
        console.log(`  PUBLISHED: ${post.id} → media ${mediaId}`);
        done++;
      } catch (e) {
        const st = post.social && post.social.instagram && post.social.instagram;
        const attemptCount = ((st && st.attemptCount) || 0) + 1;
        markSocial(post, file, {
          status: 'failed',
          error: String(e.message).slice(0, 300),
          imagePath: relPath,
          attemptCount,
          lastAttemptAt: new Date().toISOString(),
          lastAttemptError: String(e.message).slice(0, 300),
          updatedAt: new Date().toISOString()
        });
        console.error(`  [FAILED] ${post.id}: ${e.message} (attempt ${attemptCount}) (website unaffected)`);
        failed++;
        hadApiFailure = true;
      }
    }
  }
  console.log(`\nsocial-publish.mjs [${PHASE}]: ${generated} artifact(s), ${done} processed, ${failed} failed, ${skipped} over-limit skipped (website unaffected)`);
  if (PHASE === 'publish' && hadApiFailure) {
    process.exit(1);
  }
}

await main();
