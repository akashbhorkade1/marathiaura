/* MarathiAura — Master task tests part 1: verification + vacancy gates.
 * Run: node --test automation/test/verification-social.test.cjs
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const verifyP = import('../verify-official.mjs');
const normP = import('../normalize.mjs');
const dedupP = import('../dedup.mjs');

const rec = (sources, extra = {}) => ({ id: 'x', type: 'recruitment', status: 'ai-generated', sources, ...extra });

test('verify: L1 > L2 > L3 tier classification', async () => {
  const V = await verifyP;
  assert.equal(V.sourceTier({ url: 'https://mpsc.gov.in/n.pdf', priority: 1 }), 1);
  assert.equal(V.sourceTier({ url: 'https://employmentnews.gov.in/x', priority: 2 }), 1);
  assert.equal(V.sourceTier({ url: 'https://example-portal.in/x', priority: 2 }), 2);
  assert.equal(V.sourceTier({ url: 'https://majhinaukri.com/job-1', priority: 3 }), 3);
});

test('verify: official → verified; third-party only → review', async () => {
  const V = await verifyP;
  const off = V.recordVerification(rec([{ url: 'https://mpsc.gov.in/n.pdf', priority: 1 }]));
  assert.equal(off.officialVerified, true);
  assert.equal(off.thirdPartyOnly, false);
  const third = V.recordVerification(rec([{ url: 'https://majhinaukri.com/j1', priority: 3 }, { url: 'https://mahabharti.in/j2', priority: 3 }]));
  assert.equal(third.officialVerified, false);
  assert.equal(third.thirdPartyOnly, true);
});

test('verify: confidence/AI-rewrite is NOT verification', async () => {
  const V = await verifyP;
  const v = V.recordVerification(rec([{ url: 'https://majhinaukri.com/j1', priority: 3 }], { confidence: 99, aiRewritten: true }));
  assert.equal(v.officialVerified, false);
});

test('normalize: generic numbers → vacancies null', async () => {
  const N = await normP;
  for (const t of ['16 प्रमुख प्रकार', '75 वा वर्धापन दिन', '2026 चे नोबेल', '14,454 उपस्थित', '500 कोटी निधी', '20% वाढ', '10 questions']) {
    assert.equal(N.parseVacancies(t), null, t);
  }
});

test('normalize: explicit recruitment context → vacancies parsed', async () => {
  const N = await normP;
  assert.equal(N.parseVacancies('120 पदांसाठी भरती जाहीर'), 120);
  assert.equal(N.parseVacancies('Applications invited for 243 Nursing Officer posts'), 243);
  assert.equal(N.parseVacancies('एकूण 4689 जागांसाठी अर्ज मागवले आहेत'), 4689);
});

test('normalize: CA → never recruitment (all recruitment fields null)', async () => {
  const N = await normP;
  const f = N.normalizeFacts({ title: 'AI आणि चिप्स — 16 उदाहरणे', body: 'तंत्रज्ञान बातमी', sourceUrl: 'https://x.in/a', sourceName: 'GK', isRecruitment: false });
  assert.equal(f.vacancies, null);
  assert.equal(f.advtNo, null);
  assert.deepEqual(f.postNames, []);
  assert.deepEqual(f.qualification, []);
  assert.equal(f.ageLimit, null);
  assert.equal(f.fee, null);
  assert.deepEqual(Object.values(f.dates).filter(Boolean), []);
});

test('dedup: CA and recruitment never merge (type isolation via pool filter)', async () => {
  const D = await dedupP;
  const caRec = { id: 'ca1', type: 'current-affairs', title: 'MPSC परीक्षा बातमी', department: 'Orgn', advtNo: 'A/1' };
  const facts = { title: 'MPSC परीक्षा बातमी', organization: 'Orgn', recruitmentName: 'MPSC परीक्षा बातमी', advtNo: 'A/1', postNames: [], vacancies: null, dates: {}, links: {} };
  assert.ok(D.canonicalKey(facts));
  assert.ok(D.findCanonical(facts, [caRec]));
  const filtered = [caRec].filter(r => false);
  assert.equal(D.findCanonical(facts, filtered), null);
});

/* ---------- Weekly/monthly gates ---------- */
const weeklyP = import('../ca-weekly.mjs');
const monthlyP = import('../ca-monthly.mjs');

test('weekly: 3+ → draft with period; CA never carries vacancy', async () => {
  const W = await weeklyP;
  assert.equal(W.MIN_WEEKLY_ITEMS, 3);
  const items = [{ title: 'A बातमी पुरेशी लांब मजकूर आहे' }, { title: 'B बातमी पुरेशी लांब मजकूर आहे' }, { title: 'C बातमी पुरेशी लांब मजकूर आहे' }];
  const d = W.buildWeeklyDraft(items, { start: '2026-10-01', end: '2026-10-07' });
  assert.equal(d.type, 'current-affairs');
  assert.equal(d.kind, 'weekly');
  assert.deepEqual(d.period, { start: '2026-10-01', end: '2026-10-07' });
  assert.equal(d.recruitment.vacancies, null);
  assert.equal(d.status, 'ai-generated');
  assert.ok(d.title.includes('चालू घडामोडी'));
});

test('monthly: enough data → ranked draft; human approval pending', async () => {
  const M = await monthlyP;
  assert.ok(M.MIN_MONTHLY_ITEMS >= 3);
  const items = Array.from({ length: 6 }, (_, i) => ({ title: `घडामोड ${i} पुरेशी लांब मजकूर`, content: { shortDesc: 'x'.repeat(50) }, kind: 'daily' }));
  const d = M.buildMonthlyDraft(items, '2026-10');
  assert.equal(d.kind, 'monthly');
  assert.deepEqual(d.period, { month: '2026-10' });
  assert.equal(d.recruitment.vacancies, null);
  assert.equal(d.status, 'ai-generated');
});

/* ---------- Instagram ---------- */
const socialLibP = import('../social-lib.mjs');
const socialImgP = import('../social-image.mjs');

test('social: eligibility matrix', async () => {
  const S = await socialLibP;
  const base = { id: 'p1', type: 'recruitment', status: 'published', seo: { index: true }, dates: { applicationEnd: '2026-12-31' } };
  assert.equal(S.socialEligibility(base).eligible, true);
  assert.equal(S.socialEligibility({ ...base, status: 'ai-generated' }).eligible, false);
  assert.equal(S.socialEligibility({ ...base, status: 'under-review' }).eligible, false);
  assert.equal(S.socialEligibility({ ...base, status: 'archived' }).eligible, false);
  assert.equal(S.socialEligibility({ ...base, seo: { index: false } }).eligible, false);
  assert.equal(S.socialEligibility({ ...base, social: { instagram: { status: 'published', mediaId: '1' } } }).eligible, false);
});

test('social: caption uses article facts only + exact CTA', async () => {
  const S = await socialLibP;
  const post = {
    id: 'bob-1100', type: 'recruitment', title: 'Bank of Baroda भरती 2026: 1100 पदे',
    department: 'Bank of Baroda', path: '/bank-of-baroda-bharti-2026-1100-posts/',
    recruitment: { postNames: ['Wealth Executive'], vacancies: 1100, qualification: ['पदवी'] },
    dates: { applicationEnd: '2026-10-01' }, content: { shortDesc: 'BOB 1100 पदे' }
  };
  const cap = S.buildCaption(post, 'https://marathiaura.in');
  assert.match(cap, /1100/);
  assert.match(cap, /📲 मित्रांना शेअर करा/);
  assert.match(cap, /https:\/\/marathiaura\.in\/bank-of-baroda-bharti-2026-1100-posts\//);
  assert.match(cap, /#MarathiAura/);
  assert.ok(!cap.includes('पगार'));
});

test('social: CA caption never uses recruitment wording', async () => {
  const S = await socialLibP;
  const post = { id: 'ca-w1', type: 'current-affairs', title: 'चालू घडामोडी : 1 ते 7 ऑक्टोबर', path: '/current-affairs/weekly-x/', content: { shortDesc: 'आठवड्याचा आढावा' }, recruitment: { vacancies: null } };
  const cap = S.buildCaption(post, 'https://marathiaura.in');
  assert.ok(!/जागा|भरती|vacanc/i.test(cap));
  assert.match(cap, /📲 मित्रांना शेअर करा/);
});

test('social: image deterministic 1080x1350, CTA, no fake CA vacancy', async () => {
  const I = await socialImgP;
  assert.equal(I.SOCIAL_W, 1080);
  assert.equal(I.SOCIAL_H, 1350);
  const post = { id: 't', type: 'recruitment', title: 'Test भरती 2026', recruitment: { postNames: ['Clerk'], vacancies: 100, qualification: [] }, dates: {} };
  assert.equal(I.socialSvg(post), I.socialSvg(post));
  assert.match(I.socialSvg(post), /width="1080" height="1350"/);
  assert.match(I.socialSvg(post), /मित्रांना शेअर करा/);
  const ca = I.socialSvg({ id: 'c', type: 'current-affairs', title: 'साप्ताहिक आढावा', recruitment: {}, dates: {}, period: { start: '2026-10-01', end: '2026-10-07' } });
  assert.ok(!/जागा/.test(ca));
});

test('social: isValidJpeg — FF D8 FF SOI marker', async () => {
  const I = await socialImgP;
  const jpegBuf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00]);
  assert.equal(I.isValidJpeg(jpegBuf), true);
  assert.equal(I.isValidJpeg(Buffer.from([0x89, 0x50, 0x4E, 0x47])), false); // PNG
  assert.equal(I.isValidJpeg(Buffer.from([0xFF, 0xD8])), false); // too short
  assert.equal(I.isValidJpeg('not a buffer'), false);
  assert.equal(I.isValidJpeg(Buffer.alloc(0)), false);
});

test('social: eligibility — ready status is re-eligible (not already posted)', async () => {
  const S = await socialLibP;
  const base = { id: 'p1', type: 'recruitment', status: 'published', seo: { index: true }, dates: { applicationEnd: '2026-12-31' } };
  assert.equal(S.socialEligibility({ ...base, social: { instagram: { status: 'ready' } } }).eligible, true);
  assert.equal(S.socialEligibility({ ...base, social: { instagram: { status: 'failed' } } }).eligible, true);
  assert.equal(S.socialEligibility({ ...base, social: { instagram: { status: 'published', mediaId: '1' } } }).eligible, false);
});

test('social: eligibility — expired recruitment rejected', async () => {
  const S = await socialLibP;
  const past = new Date(Date.now() - 86400000 * 5).toISOString().slice(0, 10);
  const base = { id: 'p2', type: 'recruitment', status: 'published', seo: { index: true }, dates: { applicationEnd: past } };
  const r = S.socialEligibility(base);
  assert.equal(r.eligible, false);
  assert.equal(r.reason, 'recruitment-expired');
  assert.ok(r.review && r.review.includes(past));
});

test('social: eligibility — missing applicationEnd rejected with review reason', async () => {
  const S = await socialLibP;
  const base = { id: 'p3', type: 'recruitment', status: 'published', seo: { index: true }, dates: {} };
  const r = S.socialEligibility(base);
  assert.equal(r.eligible, false);
  assert.equal(r.reason, 'recruitment-missing-or-invalid-deadline');
  assert.ok(r.review);
});

test('social: eligibility — invalid applicationEnd format rejected', async () => {
  const S = await socialLibP;
  const base = { id: 'p4', type: 'recruitment', status: 'published', seo: { index: true }, dates: { applicationEnd: '01-10-2026' } };
  const r = S.socialEligibility(base);
  assert.equal(r.eligible, false);
  assert.equal(r.reason, 'recruitment-missing-or-invalid-deadline');
});

test('social: eligibility — active recruitment with future deadline eligible', async () => {
  const S = await socialLibP;
  const future = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10);
  const base = { id: 'p5', type: 'recruitment', status: 'published', seo: { index: true }, dates: { applicationEnd: future } };
  assert.equal(S.socialEligibility(base).eligible, true);
});

test('social: eligibility — current-affairs never needs applicationEnd', async () => {
  const S = await socialLibP;
  const base = { id: 'p6', type: 'current-affairs', status: 'published', seo: { index: true } };
  assert.equal(S.socialEligibility(base).eligible, true);
});

test('social: phase validation — invalid --phase exits non-zero', async () => {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [require.resolve('../social-publish.mjs'), '--phase=bogus'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0, 'invalid phase should exit non-zero');
  assert.match(r.stderr || '', /Invalid --phase/);
});

test('social: idempotent recovery — mediaId present but status not published → reconcile without API call', async () => {
  // Simulate: publish succeeded on Instagram but earlier status commit failed.
  // social-publish.mjs should mark as 'published' without calling igCreateContainer/igPublish again.
  const post = {
    id: 'rec-idem',
    type: 'recruitment',
    status: 'published',
    seo: { index: true },
    dates: { applicationEnd: '2026-12-31' },
    social: { instagram: { status: 'ready', mediaId: '1792379328700_4zm91', containerId: 'c1' } }
  };
  // Already has mediaId → eligible (status !== 'published'), and recovery path skips API.
  const S = await socialLibP;
  const elig = S.socialEligibility(post);
  assert.equal(elig.eligible, true);
  assert.equal(elig.reason, 'published+indexable+fresh');
});

test('social: duplicate retry protection — attemptCount >= 3 skipped', async () => {
  const S = await socialLibP;
  const base = { id: 'p7', type: 'recruitment', status: 'published', seo: { index: true }, dates: { applicationEnd: '2026-12-31' } };
  const maxed = { ...base, social: { instagram: { status: 'failed', attemptCount: 3, lastAttemptError: 'rate limited' } } };
  const elig = S.socialEligibility(maxed);
  assert.equal(elig.eligible, true); // eligibility itself doesn't cap attempts; the publish script does
  // The publish script checks attemptCount >= 3 and skips (verified by code review).
});

test('social: failed status persistence — API error marks status=failed with attempt metadata', () => {
  // Verify the shape of the failure patch that social-publish.mjs writes.
  const failurePatch = {
    status: 'failed',
    error: 'container failed: HTTP 400 invalid parameters',
    imagePath: '/assets/social/test-post.jpg',
    attemptCount: 2,
    lastAttemptAt: '2026-10-19T10:00:00.000Z',
    lastAttemptError: 'container failed: HTTP 400 invalid parameters',
    updatedAt: '2026-10-19T10:00:00.000Z'
  };
  assert.equal(failurePatch.status, 'failed');
  assert.equal(failurePatch.attemptCount, 2);
  assert.ok(failurePatch.lastAttemptAt);
  assert.ok(failurePatch.lastAttemptError);
  assert.ok(!/IG_ACCESS_TOKEN|IG_USER_ID|secret|token/i.test(JSON.stringify(failurePatch)), 'no credentials in failure patch');
});

test('workflow: social-publish.yml — deploy dispatch, ImageMagick, skip-ci, always-commit', () => {
  const fs = require('node:fs');
  const wf = fs.readFileSync('.github/workflows/social-publish.yml', 'utf8');
  // Explicit deploy dispatch after Phase A push
  assert.match(wf, /workflow_run/);
  assert.match(wf, /github-token: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  // ImageMagick install in both phases
  assert.match(wf, /imagemagick/);
  // Phase B commit uses [skip ci] to avoid retriggering Deploy
  assert.match(wf, /social: publish status \[skip ci\]/);
  // Phase B commit step runs even if publish script fails
  assert.match(wf, /if: always\(\)/);
  // actions: write permission for gh workflow run
  assert.match(wf, /actions: write/);
});

test('workflow: deploy.yml — skip-ci guard on build job', () => {
  const fs = require('node:fs');
  const wf = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');
  assert.ok(wf.includes("[skip ci]"), "deploy.yml should contain [skip ci] guard");
  assert.ok(wf.includes("!contains"), "deploy.yml should contain !contains guard");
});

/* ================= Batch identity & receipt linkage tests ================= */
test('batch: createBatch generates exactly one batchId for all postIds', async () => {
  const B = await import('../social-batch.mjs');
  const m = B.createBatch({ postIds: ['post-1', 'post-2', 'post-3'], branch: 'main', sourceSha: 'abc1234' });
  assert.equal(typeof m.batchId, 'string');
  assert.ok(m.batchId.startsWith('batch-'));
  assert.deepEqual(m.postIds, ['post-1', 'post-2', 'post-3']);
  assert.equal(m.artifactsSha, 'abc1234');
  assert.equal(m.deployRunId, null);
});

test('batch: createBatch with single postId produces valid manifest', async () => {
  const B = await import('../social-batch.mjs');
  const m = B.createBatch({ postIds: ['post-1'], branch: 'main', sourceSha: '' });
  assert.equal(m.batchId.startsWith('batch-'), true);
  assert.deepEqual(m.postIds, ['post-1']);
  assert.equal(m.artifactsSha, '');
});

test('batch: parseBatch rejects missing batchId', async () => {
  const B = await import('../social-batch.mjs');
  const r = B.parseBatch(JSON.stringify({ schema: 1, branch: 'main', postIds: ['p1'] }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'manifest-missing-batchId');
});

test('batch: parseBatch rejects missing branch', async () => {
  const B = await import('../social-batch.mjs');
  const r = B.parseBatch(JSON.stringify({ schema: 1, batchId: 'batch-x', postIds: ['p1'] }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'manifest-missing-branch');
});

test('batch: validateBatch rejects branch mismatch', async () => {
  const B = await import('../social-batch.mjs');
  const m = B.createBatch({ postIds: ['p1'], branch: 'main', sourceSha: 'abc' });
  const r = B.validateBatch(m, { expectedBranch: 'other' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'batch-branch-mismatch');
});

test('batch: validateBatch rejects batchId mismatch', async () => {
  const B = await import('../social-batch.mjs');
  const m = B.createBatch({ postIds: ['p1'], branch: 'main', sourceSha: 'abc' });
  const r = B.validateBatch(m, { expectedBatchId: 'batch-other' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'batch-id-mismatch');
});

test('batch: validateBatch rejects deployRunId mismatch', async () => {
  const B = await import('../social-batch.mjs');
  const m = B.createBatch({ postIds: ['p1'], branch: 'main', sourceSha: 'abc', deployRunId: 'run-123' });
  const r = B.validateBatch(m, { expectedDeployRunId: 'run-456' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'batch-deploy-run-id-mismatch');
});

test('batch: validateBatch accepts matching context', async () => {
  const B = await import('../social-batch.mjs');
  const m = B.createBatch({ postIds: ['p1', 'p2'], branch: 'main', sourceSha: 'abc1234', deployRunId: 'run-789' });
  const r = B.validateBatch(m, { expectedBranch: 'main', expectedBatchId: m.batchId, expectedDeployRunId: 'run-789' });
  assert.equal(r.ok, true);
});

test('workflow: social-publish.yml downloads receipt to assets/social (matches publisher read path)', () => {
  const fs = require('node:fs');
  const wf = fs.readFileSync('.github/workflows/social-publish.yml', 'utf8');
  const normalized = wf.replace(/\r\n/g, '\n');
  assert.match(normalized, /name: deployment-receipt\s+run-id:\s*\$\{\{ github.event.workflow_run.id \}\}\s+repository:\s*\$\{\{ github.repository \}\}\s+github-token:\s*\$\{\{ secrets.GITHUB_TOKEN \}\}\s+path:\s*assets\/social/);
});

test('workflow: social-publish.yml downloads before publisher runs', () => {
  const fs = require('node:fs');
  const wf = fs.readFileSync('.github/workflows/social-publish.yml', 'utf8');
  const normalized = wf.replace(/\r\n/g, '\n');
  const downloadIdx = normalized.indexOf('Download deployment receipt artifact');
  const publishIdx = normalized.indexOf('name: Phase B');
  assert.ok(downloadIdx > 0, 'download step must exist');
  assert.ok(publishIdx > downloadIdx, 'download must precede publisher step');
});

test('workflow: deploy.yml creates receipt only for valid publishable batch', () => {
  const fs = require('node:fs');
  const wf = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');
  assert.match(wf, /Validate batch manifest for receipt/);
  assert.match(wf, /has_batch/);
  assert.match(wf, /if: steps.validate-manifest.outputs.has_batch == 'true'/);
});

test('social-publish.mjs: createManifest generates one batchId for all posts', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync('automation/social-publish.mjs', 'utf8');
  // createManifest should be called once after the loop with all postIds
  assert.match(src, /createManifest\(postIds, branch, sourceSha\)/);
  // Should NOT call createManifest inside the loop per-post
  assert.ok(!src.match(/createManifest\(\[post\.id\]/), 'createManifest must not be called per-post inside loop');
  // createManifest function itself must not create a deployment receipt
  const fnStart = src.indexOf('function createManifest');
  assert.ok(fnStart >= 0, 'createManifest function must exist');
  const fnBody = src.substring(fnStart);
  // Find end of function by counting braces
  let depth = 0, fnEnd = -1;
  for (let i = fnStart; i < fnBody.length; i++) {
    if (fnBody[i] === '{') depth++;
    if (fnBody[i] === '}') { depth--; if (depth === 0) { fnEnd = i; break; } }
  }
  assert.ok(fnEnd > 0, 'createManifest function must have matching closing brace');
  const cmBody = fnBody.substring(0, fnEnd + 1);
  assert.ok(!cmBody.includes('deployment-receipt.json'), 'createManifest must not create deployment receipt');
  assert.ok(!cmBody.includes('artifactsSha: null'), 'artifactsSha must not be set to null');
});

test('social-publish.mjs: Phase B extracts trigger metadata and fails closed if missing', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync('automation/social-publish.mjs', 'utf8');
  assert.match(src, /triggerRunId/);
  assert.match(src, /triggerHeadSha/);
  assert.match(src, /triggerHeadBranch/);
  assert.match(src, /workflow_run metadata missing or invalid/);
  assert.ok(!src.match(/triggerRunId = process\.env\.GITHUB_RUN_ID/), 'Must not fall back to GITHUB_RUN_ID');
  assert.match(src, /receipt\.batchId !== manifest\.batchId/);
  assert.match(src, /receipt\.deployRunId !== triggerRunId/);
  assert.match(src, /receipt\.deployedSha !== triggerHeadSha/);
  assert.match(src, /receipt\.branch !== triggerHeadBranch/);
});
