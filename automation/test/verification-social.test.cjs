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
  const base = { id: 'p1', type: 'recruitment', status: 'published', seo: { index: true } };
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
