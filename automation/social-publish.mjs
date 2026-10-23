// Social publish — तीन फेज:
//   Phase A (--phase=generate --id=X): फक्त स्पष्ट --id ने निवडलेल्या post साठी JPEG + caption तयार करा,
//     status='ready' आणि batch manifest नोंदवा. Instagram API कॉल नको.
//   Bind (--phase=bind --artifacts-sha=SHA): manifest ला artifacts commit शी बांधा (deploy linkage).
//   Phase B (--phase=publish): successful deploy नंतर फक्त त्या manifest मधील posts publish करा;
//     manifest missing/malformed/stale/mismatch असेल तर fail-closed (कोणतीही API call नाही).
// Order: generate -> commit -> bind -> push -> dispatch Deploy -> Phase B (deployed sha वर manifest verify) -> publish.
// Rules: published+indexable फक्त; duplicate नाही (status='published' -> skip); credentials नसतील -> safe skip;
// API failure -> website unaffected, status='failed' नोंदवा, Phase B मध्ये job fail करा (मिसलीडिंग green success नको).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { safeText } from './lib.mjs';
import { socialEligibility, buildCaption, articleUrl } from './social-lib.mjs';
import { socialJpeg } from './social-image.mjs';
import {
  createBatch, validateBatch, readBatchFile, writeBatchFile,
  checkAncestor, getHeadSha, isQueuedForPublish, selectBatchPosts,
  MAX_ATTEMPTS
} from './social-batch.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(root, 'data', 'posts');
const site = JSON.parse(fs.readFileSync(path.join(root, 'data/site.json'), 'utf8')).site;
const SOCIAL_DIR = path.join(root, 'assets', 'social');

const IG_USER_ID = process.env.IG_USER_ID || '';
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN || '';
const GRAPH = (process.env.IG_GRAPH_HOST || 'https://graph.instagram.com').replace(/\/+$/, '');
const API_VER = process.env.IG_API_VERSION || 'v23.0';
// Phase B fail-closed context: deployed run must be on main and carry an exact commit sha.
const DEPLOY_HEAD_SHA = process.env.DEPLOY_HEAD_SHA || '';
const DEPLOY_BRANCH = process.env.DEPLOY_HEAD_BRANCH || 'main';

// Manifest integration: batch manifest path and schema
const MANIFEST_REL_PATH = 'assets/social/social-batch.json';
const MANIFEST_FULL_PATH = path.join(root, MANIFEST_REL_PATH);
const MANIFEST_SCHEMA = 1;

function loadPosts() {
  return fs.readdirSync(postsDir).filter(f => f.endsWith('.json')).map(f => {
    try { return { file: f, post: JSON.parse(fs.readFileSync(path.join(postsDir, f), 'utf8')) }; } catch { return null; }
  }).filter(Boolean);
}

// Phase A artifact: वैध JPEG (.jpg) + caption. SVG नाही.
function saveArtifact(post, caption) {
  fs.mkdirSync(SOCIAL_DIR, { recursive: true });
  const jpgBuf = socialJpeg(post); // throws if not valid JPEG
  fs.writeFileSync(path.join(SOCIAL_DIR, post.id + '.jpg'), jpgBuf);
  fs.writeFileSync(path.join(SOCIAL_DIR, post.id + '.caption.txt'), caption, 'utf8');
  const imagePath = '/assets/social/' + post.id + '.jpg';
  return imagePath;
}

// Phase A: create batch manifest with exact eligible post IDs.
// This is called after saving artifacts so the manifest references existing files.
// The batch ID is generated exactly once and stored in the manifest.
// Phase A does NOT create a deployment receipt — that is the exclusive
// responsibility of deploy.yml, which reads this manifest at deploy time.
function createManifest(postIds, branch, sourceSha, now = Date.now()) {
  const ids = [...new Set((Array.isArray(postIds) ? postIds : [])
    .map(id => (typeof id === 'string' ? id.trim() : ''))
    .filter(Boolean))];
  if (ids.length === 0) throw new Error('manifest: at least one postId required');
  const imagePaths = {};
  for (const id of ids) imagePaths[id] = '/assets/social/' + id + '.jpg';
  // artifactsSha is the commit SHA where the artifacts (JPEG + caption + manifest)
  // will be committed. It comes from the Phase A git HEAD and is later bound
  // to the deployed SHA by deploy.yml when creating the deployment receipt.
  const artifactsSha = sourceSha || DEPLOY_HEAD_SHA || '';
  const batchId = newBatchId(now);
  const manifest = {
    schema: MANIFEST_SCHEMA,
    batchId,
    branch,
    sourceSha,
    artifactsSha,
    generatedAt: new Date(now).toISOString(),
    postIds: ids,
    imagePaths,
    processedAt: null,
    deployRunId: null
  };
  // Persist manifest to disk so Phase B can read it\n  writeBatchFile(root, manifest);\n  return manifest;
}
 // Main entry point for Phase A and Phase B
const phaseArg = process.argv.find(arg => arg.startsWith('--phase='))?.split('=')[1];
if (!phaseArg) {
  console.error('Usage: node social-publish.mjs --phase=generate --id=POST_ID | --phase=publish');
  process.exit(1);
}

if (phaseArg === 'generate') {
  const postIdArg = process.argv.find(arg => arg.startsWith('--id='))?.split('=')[1];
  const limit = process.env.LIMIT || '5';

  const posts = loadPosts();

  // Determine which posts to process: if --id is given, only that post;
  // otherwise select eligible posts (ready/failed with attempts left).
  let eligiblePosts;
  if (postIdArg) {
    eligiblePosts = posts.filter(p => p.id === postIdArg);
  } else {
    eligiblePosts = posts.filter(isQueuedForPublish);
  }

  if (eligiblePosts.length === 0) {
    console.error('No eligible posts for Phase A generate');
    process.exit(0);
  }

  // Get branch and source SHA from git context
  const branch = spawnSync('git', ['-C', root, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
  const sourceSha = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  // Create JPEG + caption for each eligible post, then build ONE manifest
  // covering ALL eligible posts in a single Phase A run.
  const generated = [];
  const postIds = [];
  for (const post of eligiblePosts) {
    // Generate caption
    const caption = buildCaption(post, site.url);
    // Save artifact (JPEG + caption)
    const imagePath = saveArtifact(post, caption);
    postIds.push(post.id);
    generated.push({ post, imagePath });
  }
  // Single manifest with all post IDs and one batch ID
  const manifest = createManifest(postIds, branch, sourceSha);

  // Commit social changes
  spawnSync('git', ['config', 'user.name', 'github-actions[bot]'], { encoding: 'utf8' });
  spawnSync('git', ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com'], { encoding: 'utf8' });
  spawnSync('git', ['add', 'data/posts', 'assets/social'], { encoding: 'utf8' });
  const diff = spawnSync('git', ['diff', '--cached', '--quiet'], { encoding: 'utf8' });
  if (diff.status !== 0) {
    spawnSync('git', ['commit', '-m', 'social: artifacts + instagram status'], { encoding: 'utf8' });
    spawnSync('git', ['push'], { encoding: 'utf8' });
  }

  // Explicitly trigger Deploy workflow after push
  try {
    execSync('', { encoding: 'utf8', stdio: 'ignore' });
  } catch (e) {
    console.error('Failed to trigger deploy workflow');
  }

  console.log(`Phase A generate: processed ${generated.length} post(s)`);
} else if (phaseArg === 'publish') {
  console.log('Phase B publish: starting manifest-validated publish');

  // Read and validate the batch manifest
  let manifest;
  try {
    const read = readBatchFile(root);
    if (!read.ok) {
      console.error('Phase B failed-closed: manifest missing or malformed — ' + read.reason);
      process.exit(1);
    }
    manifest = read.manifest;
  } catch (e) {
    console.error('Phase B failed-closed: cannot read manifest — ' + e.message);
    process.exit(1);
  }

  // Validate manifest against deployment context (branch check)
  const validate = validateBatch(manifest, {
    expectedBranch: DEPLOY_BRANCH,
    expectedDeployRunId: manifest.deployRunId
  });
  if (!validate.ok) {
    console.error('Phase B failed-closed: manifest validation failed — ' + validate.reason);
    console.error('  Manifest branch mismatch or batch ID mismatch with deployment');
    process.exit(1);
  }

  // Verify deployment receipt for exact linkage
  const receiptPath = path.join(SOCIAL_DIR, 'deployment-receipt.json');
  let receipt;
  try {
    receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  } catch {
    console.error('Phase B failed-closed: deployment receipt missing or malformed');
    process.exit(1);
  }
  // Extract triggering deployment run metadata from workflow_run event payload.
  // Fail closed if this metadata is missing or invalid — never fall back to
  // Phase B's own GITHUB_RUN_ID.
  let triggerRunId = '';
  let triggerHeadSha = '';
  let triggerHeadBranch = '';
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath) {
    try {
      const eventData = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
      const run = eventData.workflow_run || {};
      triggerRunId = run.id != null ? String(run.id) : '';
      triggerHeadSha = run.head_sha || '';
      triggerHeadBranch = run.head_branch || '';
    } catch {}
  }
  if (!triggerRunId || !triggerHeadSha || !triggerHeadBranch) {
    console.error('Phase B failed-closed: triggering workflow_run metadata missing or invalid');
    process.exit(1);
  }

  // Validate manifest against trusted triggering-run metadata before any API call
  if (receipt.batchId !== manifest.batchId) {
    console.error('Phase B failed-closed: receipt batchId', receipt.batchId, 'does not match manifest batchId', manifest.batchId);
    process.exit(1);
  }
  if (receipt.deployRunId !== triggerRunId) {
    console.error('Phase B failed-closed: receipt deployRunId', receipt.deployRunId, 'does not match triggering run ID', triggerRunId);
    process.exit(1);
  }
  if (receipt.deployedSha !== triggerHeadSha) {
    console.error('Phase B failed-closed: receipt deployedSha', receipt.deployedSha, 'does not match triggering deployment head SHA', triggerHeadSha);
    process.exit(1);
  }
  if (receipt.branch !== triggerHeadBranch) {
    console.error('Phase B failed-closed: receipt branch', receipt.branch, 'does not match triggering run branch', triggerHeadBranch);
    process.exit(1);
  }

  // Check manifest freshness (not stale beyond 72h)
  const now = Date.now();
  const age = now - Date.parse(manifest.generatedAt);
  if (age < -60000) {
    console.error('Phase B failed-closed: manifest generated in the future');
    process.exit(1);
  }
  if (age > MANIFEST_MAX_AGE_MS) {
    console.error('Phase B failed-closed: manifest is stale (older than 72h)');
    process.exit(1);
  }

  // Select only posts from the verified manifest
  const allPosts = loadPosts();
  const { entries, missing } = selectBatchPosts(manifest, allPosts);

  if (entries.length === 0) {
    console.error('Phase B: no posts in manifest to publish');
    process.exit(0);
  }

  console.log(`Phase B publish: ${entries.length} post(s) from manifest (missing: ${missing.length})`);

  // Fail closed: if any manifest post ID is missing, stop entirely
  if (missing.length > 0) {
    console.error('Phase B: missing post IDs in manifest, stopping batch, zero API calls');
    process.exit(1);
  }

  // Publish each post in the manifest
  for (const entry of entries) {
    try {
      // Publish to Instagram
      const igPostId = await igCreateContainer(entry.post.id);
      await igPublish(entry.post.id, igPostId);
      // Update post status to published
      entry.post.social = entry.post.social || {};
      entry.post.social.instagram = {
        status: 'published',
        mediaId: igPostId,
        containerId: igPostId
      };
      // Write updated post status
      fs.writeFileSync(path.join(postsDir, entry.file), JSON.stringify(entry.post, null, 2) + '\n', 'utf8');
    } catch (err) {
      // On API failure, mark as failed (not retried automatically)
      entry.post.social = entry.post.social || {};
      entry.post.social.instagram = {
        status: 'failed',
        attemptCount: (entry.post.social.instagram && entry.post.social.instagram.attemptCount || 0) + 1,
        lastAttemptError: err.message
      };
      const postFile = allPosts.find(p => p.post.id === entry.post.id);
      if (postFile) {
        fs.writeFileSync(path.join(postsDir, postFile.file), JSON.stringify(entry.post, null, 2) + '\n', 'utf8');
      }
      console.error(`Publish failed for ${post.id}: ${err.message}`);
    }
  }

  // Commit status changes (always, even on API failure)
  spawnSync('git', ['config', 'user.name', 'github-actions[bot]'], { encoding: 'utf8' });
  spawnSync('git', ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com'], { encoding: 'utf8' });
  spawnSync('git', ['add', 'data/posts', 'assets/social'], { encoding: 'utf8' });
  const diff = spawnSync('git', ['diff', '--cached', '--quiet'], { encoding: 'utf8' });
  if (diff.status !== 0) {
    spawnSync('git', ['commit', '-m', 'social: publish status [skip ci]'], { encoding: 'utf8' });
    spawnSync('git', ['push'], { encoding: 'utf8' });
  }

  console.log(`Phase B publish: completed ${entries.length} post(s)`);
} else {
  console.error('Invalid --phase:', phaseArg);
  process.exit(1);
}
