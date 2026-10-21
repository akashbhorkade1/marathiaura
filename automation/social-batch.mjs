// Social batch manifest — Phase A ने निवडलेल्या exact post IDs हेच Phase B publish करतो.
// फक्त ready/failed status + manifest मधीलच posts; legacy queue automatic बाहेर.
// Fail-closed: manifest missing / malformed / stale / branch or deploy-commit mismatch
// असल्यास publishing पूर्णपणे बंद (कोणतीही API call नाही).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const MANIFEST_REL_PATH = 'assets/social/social-batch.json';
export const MANIFEST_MAX_AGE_MS = 72 * 3600 * 1000; // 72h stale window
export const MANIFEST_SCHEMA = 1;
export const MAX_ATTEMPTS = 3;

export const imagePathFor = postId => `/assets/social/${postId}.jpg`;

// Unique batch id: time + random suffix (concurrent Phase A runs never collide).
export function newBatchId(now = Date.now()) {
  const t = new Date(now).toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  return `batch-${t}-${crypto.randomBytes(6).toString('hex')}`;
}

export function createBatch({ postIds, branch = 'main', sourceSha = '', now = Date.now(), deployRunId }) {
  const ids = [...new Set((Array.isArray(postIds) ? postIds : [])
    .map(id => (typeof id === 'string' ? id.trim() : ''))
    .filter(Boolean))];
  if (ids.length === 0) throw new Error('batch manifest: at least one postId required');
  const generatedAt = new Date(now).toISOString();
  const imagePaths = {};
  for (const id of ids) imagePaths[id] = imagePathFor(id);
  return {
    schema: MANIFEST_SCHEMA,
    batchId: newBatchId(now),
    branch,
    sourceSha,
    generatedAt,
    postIds: ids,
    imagePaths,
    artifactsSha: null,
    processedAt: null,
    deployRunId: deployRunId || null
  };
}

// Structural validation (fail-closed). Returns {ok:true, manifest} or {ok:false, reason}.
export function parseBatch(text) {
  let m;
  try { m = JSON.parse(String(text)); } catch { return { ok: false, reason: 'manifest-malformed-json' }; }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return { ok: false, reason: 'manifest-not-object' };
  if (m.schema !== MANIFEST_SCHEMA) return { ok: false, reason: 'manifest-schema-unsupported' };
  if (typeof m.batchId !== 'string' || !m.batchId) return { ok: false, reason: 'manifest-missing-batchId' };
  if (typeof m.branch !== 'string' || !m.branch) return { ok: false, reason: 'manifest-missing-branch' };
  if (typeof m.generatedAt !== 'string' || Number.isNaN(Date.parse(m.generatedAt))) return { ok: false, reason: 'manifest-invalid-generatedAt' };
  if (!Array.isArray(m.postIds) || m.postIds.length === 0) return { ok: false, reason: 'manifest-empty-postIds' };
  if (m.postIds.some(id => typeof id !== 'string' || !id)) return { ok: false, reason: 'manifest-invalid-postId' };
  if (new Set(m.postIds).size !== m.postIds.length) return { ok: false, reason: 'manifest-duplicate-postIds' };
  if (!m.imagePaths || typeof m.imagePaths !== 'object' || Array.isArray(m.imagePaths)) return { ok: false, reason: 'manifest-missing-imagePaths' };
  for (const id of m.postIds) {
    if (m.imagePaths[id] !== imagePathFor(id)) return { ok: false, reason: `manifest-imagePath-mismatch:${id}` };
    if (!String(m.imagePaths[id]).endsWith('.jpg')) return { ok: false, reason: `manifest-non-jpeg-path:${id}` };
  }
  if (m.artifactsSha !== null && (typeof m.artifactsSha !== 'string' || !/^[0-9a-f]{7,40}$/i.test(m.artifactsSha))) {
    return { ok: false, reason: 'manifest-invalid-artifactsSha' };
  }
  if (typeof m.deployRunId !== 'undefined' && typeof m.deployRunId !== 'string') {
    return { ok: false, reason: 'manifest-invalid-deployRunId' };
  }
  if (m.deployRunId && m.deployRunId.length > 255) {
    return { ok: false, reason: 'manifest-deployRunId-too-long' };
  }
  return { ok: true, manifest: m };
}

// Contextual validation: expected branch/batch + freshness.
export function validateBatch(manifest, { now = Date.now(), maxAgeMs = MANIFEST_MAX_AGE_MS, expectedBranch = null, expectedBatchId = null, expectedDeployRunId = null } = {}) {
  if (expectedBranch && manifest.branch !== expectedBranch) return { ok: false, reason: 'batch-branch-mismatch' };
  if (expectedBatchId && manifest.batchId !== expectedBatchId) return { ok: false, reason: 'batch-id-mismatch' };
  if (expectedDeployRunId && manifest.deployRunId !== expectedDeployRunId) return { ok: false, reason: 'batch-deploy-run-id-mismatch' };
  // Also validate that deployRunId is present when expected
  if (expectedDeployRunId && !manifest.deployRunId) return { ok: false, reason: 'manifest-missing-deployRunId' };
  const age = now - Date.parse(manifest.generatedAt);
  if (age < -60000) return { ok: false, reason: 'manifest-generatedAt-in-future' };
  if (age > maxAgeMs) return { ok: false, reason: 'manifest-stale' };
  return { ok: true };
}

export function readBatchFile(root) {
  const p = path.join(root, MANIFEST_REL_PATH);
  if (!fs.existsSync(p)) return { ok: false, reason: 'manifest-missing' };
  return parseBatch(fs.readFileSync(p, 'utf8'));
}

export function writeBatchFile(root, manifest) {
  const p = path.join(root, MANIFEST_REL_PATH);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return p;
}

// Deterministic deploy↔manifest linkage: artifacts commit must be a real ancestor of deployed head.
export function checkAncestor(root, ancestorSha, descendantSha) {
  if (!ancestorSha || !descendantSha || ancestorSha === descendantSha) return false;
  const r = spawnSync('git', ['-C', root, 'merge-base', '--is-ancestor', ancestorSha, descendantSha], { encoding: 'utf8' });
  return r.status === 0;
}

export function getHeadSha(root) {
  const r = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
}

// Publishable queue state: only ready/failed with attempts left; published never re-queues.
export function isQueuedForPublish(post) {
  const st = post && post.social && post.social.instagram;
  if (!st) return false;
  if (st.status !== 'ready' && st.status !== 'failed') return false;
  const attempts = Number.isFinite(st.attemptCount) ? st.attemptCount : 0;
  return attempts < MAX_ATTEMPTS;
}

// Manifest selection: exact IDs, manifest order preserved; missing IDs reported for fail-closed.
export function selectBatchPosts(manifest, allPosts) {
  const byId = new Map(allPosts.map(e => [e.post.id, e]));
  const entries = [];
  const missing = [];
  for (const id of manifest.postIds) {
    const entry = byId.get(id);
    if (!entry) missing.push(id);
    else entries.push(entry);
  }
  return { entries, missing };
}
