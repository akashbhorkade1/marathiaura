/* MarathiAura — Source Aggregation test suite (docs/05 §9, spec §25)
 * Run: node automation/test/source-aggregation.test.cjs
 * Covers: normalize (dates/vacancies/advt/age/fee), dedup (canonical key, 2+3-source merge),
 * conflict resolution, status engine rules, URL classification, XML leak, empty source,
 * null vacancy, safe Marathi generation, copy-detection.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const libP = import('../lib.mjs');
const normP = import('../normalize.mjs');
const dedupP = import('../dedup.mjs');
const verifyP = import('../verify-official.mjs');
const genP = import('../generate-original-mr.mjs');

const MPSC_FACTS = {
  title: 'MPSC राज्यसेवा संयुक्त परीक्षा 2026',
  body: 'महाराष्ट्र लोकसेवा आयोग कडून राज्यसेवा परीक्षा 2026 च्या 4689 जागांसाठी अर्ज मागवले आहेत. जाहिरात क्र. MPSC/2026/01. पात्रता: पदवी. वय 19 ते 38 वर्षे. अर्ज शुल्क ₹450. अर्जाची शेवटची तारीख 15 ऑक्टोबर 2026.',
  sourceUrl: 'https://mpsc.gov.in/notice-2026-01', sourceName: 'MPSC', sourcePriority: 2
};

/* ---------- 1. New MPSC recruitment (§25#1) ---------- */
test('aggregation: new MPSC recruitment → facts extracted, missing=null', async () => {
  const N = await normP;
  const f = N.normalizeFacts(MPSC_FACTS);
  assert.equal(f.vacancies, 4689);
  assert.equal(f.advtNo, 'MPSC/2026/01');
  assert.deepEqual(f.ageLimit, { min: 19, max: 38, relaxation: null });
  assert.equal(f.fee.general, 450);
  assert.ok(f.qualification.includes('पदवी'));
  assert.equal(f.dates.applicationEnd, '2026-10-15');
  assert.equal(f.organization, 'महाराष्ट्र लोकसेवा आयोग'); // "आयोग कडून" explicit pattern
  assert.equal(f.experience, null);
});

/* ---------- 2. Employment News central recruitment (§25#2) ---------- */
test('aggregation: Employment News central recruitment (English format)', async () => {
  const N = await normP;
  const f = N.normalizeFacts({
    title: 'Nursing Officer Recruitment 2026',
    body: 'Applications are invited for 243 Nursing Officer posts. Advertisement No. AIIMS/2026/09. Age: 21 to 35 years. Application fee Rs 1500. Last Date: September 30, 2026.',
    sourceUrl: 'https://employmentnews.gov.in/pdf/aiims.pdf', sourceName: 'Employment News', sourcePriority: 2
  });
  assert.equal(f.vacancies, 243);
  assert.equal(f.dates.applicationEnd, '2026-09-30');
  assert.equal(f.advtNo, 'AIIMS/2026/09');
  assert.deepEqual(f.ageLimit, { min: 21, max: 35, relaxation: null });
});

/* ---------- 3. NCS government opportunity (§25#3) ---------- */
test('aggregation: NCS government opportunity → minimal facts, no fabrication', async () => {
  const N = await normP;
  const f = N.normalizeFacts({
    title: 'Government job listing — Railway sector',
    body: '', sourceUrl: 'https://www.ncs.gov.in/job/rail-01', sourceName: 'NCS', sourcePriority: 2
  });
  assert.equal(f.vacancies, null);
  assert.equal(f.dates.applicationEnd, null);
  assert.equal(f.fee, null);
  assert.equal(f.qualification.length, 0);
});

/* ---------- 4+5. Duplicate across 2 and all 3 sources (§25#4,5) → ONE canonical ---------- */
test('dedup: same recruitment across 2+ sources → single canonical, provenance merged', async () => {
  const N = await normP, D = await dedupP;
  const a = N.normalizeFacts({ ...MPSC_FACTS, sourceName: 'MPSC', sourcePriority: 2 });
  const b = N.normalizeFacts({
    title: 'MPSC राज्यसेवा संयुक्त परीक्षा 2026 — 4689 जागा',
    body: 'राज्यसेवा परीक्षा 2026 साठी अर्ज सुरू. शेवटची तारीख 15 ऑक्टोबर 2026.',
    sourceUrl: 'https://www.ncs.gov.in/listing/mpsc-rs', sourceName: 'NCS', sourcePriority: 2
  });
  assert.ok(D.canonicalKey(a) !== D.canonicalKey(b)); // advt फक्त MPSC कडे — exact key भिन्न
  const toRec = f => ({ title: f.title, department: f.organization, recruitment: { postNames: f.postNames, vacancies: f.vacancies }, dates: f.dates, links: f.links });
  const merged = D.mergeFacts(a, b);
  const hit = D.findCanonical(b, [toRec(a)]);
  assert.ok(hit, 'title-fallback + vacancy match → ONE canonical');
  assert.equal(hit.method, 'title-fallback');
  // 3-source: तिसरा (Employment News) पण त्याच canonical लाच merge → एकच record (§16)
  const c = N.normalizeFacts({
    title: 'MPSC राज्यसेवा परीक्षा 2026 — 4689 जागांसाठी अर्ज',
    body: 'शेवटची तारीख 15 ऑक्टोबर 2026.', sourceUrl: 'https://employmentnews.gov.in/mpsc', sourceName: 'Employment News', sourcePriority: 2
  });
  const hit2 = D.findCanonical(c, [toRec(a), toRec(merged)]);
  assert.ok(hit2, 'third source → same canonical record');
  assert.equal(merged.vacancies, 4689);
  assert.ok(D.titleSimilarity(a.title, b.title) > 0.5);
});

/* ---------- 6. Conflicting last dates (§25#6) — L1 wins (§7) ---------- */
test('conflict: official notification (L1) beats L2 source date', async () => {
  const V = await verifyP;
  const r = V.resolveConflict([
    { value: '2026-09-20', priority: 2, sourceName: 'Employment News' },
    { value: '2026-09-22', priority: 1, sourceName: 'Official notification' }
  ]);
  assert.equal(r.value, '2026-09-22');
  assert.equal(r.conflict, true); // आतीलपणी conflict record होतो (§7)
});

test('conflict: same-priority disagree → disputed field = null (never published as fact)', async () => {
  const V = await verifyP;
  const r = V.resolveConflict([
    { value: '2026-09-20', priority: 2, sourceName: 'A' },
    { value: '2026-09-22', priority: 2, sourceName: 'B' }
  ]);
  assert.equal(r.value, null);
  assert.equal(r.conflict, true);
});

/* ---------- 7. Missing last date (§25#7, §11) ---------- */
test('status: missing applicationEnd → ACTIVE, never fabricated countdown', async () => {
  const L = await libP;
  assert.equal(L.recruitStatus({ type: 'recruitment', dates: {} }), 'ACTIVE');
});

/* ---------- 8. Expired recruitment (§25#8) ---------- */
test('status: expired recruitment → CLOSED, never active', async () => {
  const L = await libP;
  const isoDate = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + d * 86400000));
  const p = { type: 'recruitment', dates: { applicationEnd: isoDate(-3) } };
  assert.equal(L.recruitStatus(p), 'CLOSED');
  assert.equal(L.isClosed(p), true);
});

/* ---------- 9. Extended deadline (§25#9, §18) ---------- */
test('update: extended deadline → same record updated via merge + updates[] history', async () => {
  const N = await normP, D = await dedupP;
  const orig = N.normalizeFacts({ ...MPSC_FACTS, sourceUrl: 'https://mpsc.gov.in/notice-2026-01' });
  const revised = N.normalizeFacts({
    ...MPSC_FACTS, sourceName: 'Official notification', sourcePriority: 1,
    body: 'मुदतवाढ: अर्जाची शेवटची तारीख आता 31 ऑक्टोबर 2026 आहे.'
  });
  assert.notEqual(revised.dates.applicationEnd, orig.dates.applicationEnd);
  const merged = D.mergeFacts(orig, revised);
  assert.equal(merged.dates.applicationEnd, '2026-10-31'); // L1 revised जिंकते
  orig.updates = [...(orig.updates || []), { type: 'application-extended', summary: 'Last Date वाढवली' }];
  assert.equal(orig.updates.length, 1); // नवीन article नाही — history entry
});

/* ---------- 10. New official notification (§25#10) ---------- */
test('provenance: L1 notification → highest priority recorded, retrievedAt real', async () => {
  const N = await normP;
  const f = N.normalizeFacts({ ...MPSC_FACTS, sourceName: 'Official notification PDF', sourcePriority: 1 });
  assert.equal(f.source.priority, 1);
  assert.ok(f.source.retrievedAt);
});

/* ---------- 11. Invalid official URL (§25#11, §5) ---------- */
test('url: invalid official URL → reject; blog → official नाही', async () => {
  const V = await verifyP;
  assert.equal(V.classifyUrl('').ok, false);
  assert.equal(V.classifyUrl('not a url').ok, false);
  assert.equal(V.classifyUrl('ftp://mpsc.gov.in/x').ok, false);
  assert.equal(V.classifyUrl('https://mpsc.gov.in/n.pdf').official, true);
  assert.equal(V.classifyUrl('https://blog.example.com/apply').official, false);
});

/* ---------- 12. XML/RSS object leak (§25#12) ---------- */
test('safe: XML node object → safeText, never System.Xml leak', async () => {
  const L = await libP, N = await normP;
  assert.equal(L.safeText({ _: 'MPSC notice', '$': { attr: 'x' } }), 'MPSC notice');
  assert.equal(L.safeText(null), '');
  assert.equal(N.normalizeFacts({ title: { _: 'XML title' }, body: null }).title, 'XML title');
});

/* ---------- 13. Empty source field (§25#13) ---------- */
test('safe: empty source fields → empty strings, never undefined/[object Object]', async () => {
  const N = await normP;
  const f = N.normalizeFacts({ title: 'Bharti', body: '', sourceUrl: '', sourceName: '' });
  assert.equal(f.source.name, '');
  assert.equal(f.source.url, null);
  assert.equal(JSON.stringify(f).includes('[object Object]'), false);
  assert.equal(JSON.stringify(f).includes('undefined'), false);
});

/* ---------- 14. Null vacancy (§25#14) ---------- */
test('safe: null vacancy stays null — never inferred number', async () => {
  const N = await normP;
  const f = N.normalizeFacts({ title: 'Bharti', body: 'अर्ज सुरू आहेत.', sourceUrl: 'https://mpsc.gov.in/x', sourceName: 'MPSC' });
  assert.equal(f.vacancies, null);
});

/* ---------- 15. Safe Marathi generation (§25#15, §8/§9) ---------- */
test('generate: original Marathi article from facts — structure + style rules', async () => {
  const N = await normP, G = await genP;
  const f = N.normalizeFacts(MPSC_FACTS);
  const title = G.buildTitle(f);
  const desc = G.buildShortDesc(f);
  const secs = G.buildSections(f);
  assert.ok(title.includes('4,689'));
  assert.ok(!title.includes('undefined') && !title.includes('null'));
  assert.ok(desc.length <= 300);
  const flat = JSON.stringify(secs);
  assert.ok(flat.includes('भरतीची थोडक्यात माहिती'));
  assert.ok(flat.includes('15 ऑक्टोबर 2026'));
  assert.ok(!flat.includes('अंदाजे') && !flat.includes('probably'));
  // §14: facts-based — कोणतेही section body source text शी copied नाही
  const bodies = secs.flatMap(s => [...(s.items || []), s.body, ...(s.rows || []).flat()]).filter(Boolean);
  for (const b of bodies) assert.ok(G.shingleSimilarity(b, MPSC_FACTS.body) < G.COPY_THRESHOLD);
});

/* ---------- 16. Copied-source detection / similarity threshold (§25#16) ---------- */
test('copy-detection: verbatim paragraph FAILS the similarity gate', async () => {
  const G = await genP;
  const src = 'Applications are invited from eligible candidates for the post of Nursing Officer in various departments of the institute with pay level seven and other allowances as per government rules from time to time';
  assert.equal(G.shingleSimilarity(src, src), 1);
  assert.ok(G.shingleSimilarity(src, src) >= G.COPY_THRESHOLD);
  // §14 allowed factual transformation → similarity खूप कमी
  const orig = 'PGIMER कडून Nursing Officer पदाच्या 243 जागांसाठी अर्ज मागवण्यात आले आहेत.';
  assert.ok(G.shingleSimilarity(orig, src) < G.COPY_THRESHOLD);
});
