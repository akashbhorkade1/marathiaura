/* MarathiAura — Renderer & Status test suite (Parts 3/8/22)
 * Run: node automation/test/render.test.cjs
 * Covers: recruitment status derivation, safe text extraction (XML/object/array/null),
 * badges, link trust labels, escaping — renderer must behave safely on bad data.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

// lib.mjs is ESM — load once via dynamic import
const libP = import('../lib.mjs');
const day = 86400000;
const isoDate = offsetDays => new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);

/* ---------- 1. Active recruitment ---------- */
test('status: no dates → ACTIVE', async () => {
  const L = await libP;
  const p = { type: 'recruitment', dates: {} };
  assert.equal(L.recruitStatus(p), 'ACTIVE');
  assert.match(L.statusBadge(p), /अर्ज सुरू/);
  assert.match(L.statusBadge(p), /data-status="ACTIVE"/);
});

/* ---------- 2. Closing soon ---------- */
test('status: last date within 7 days → CLOSING_SOON', async () => {
  const L = await libP;
  const p = { type: 'recruitment', dates: { applicationEnd: isoDate(3) } };
  assert.equal(L.recruitStatus(p), 'CLOSING_SOON');
  assert.match(L.statusBadge(p), /शेवटची तारीख जवळ/);
  assert.equal(L.isClosed(p), false);
});

test('status: 9 days out → ACTIVE (not closing)', async () => {
  const L = await libP;
  const p = { type: 'recruitment', dates: { applicationEnd: isoDate(9) } };
  assert.equal(L.recruitStatus(p), 'ACTIVE');
});

/* ---------- 3b. Not-yet-open recruitment (date-priority edge case) ---------- */
test('status: opening tomorrow + closing in 5 days → UPCOMING (not CLOSING_SOON)', async () => {
  const L = await libP;
  const p = { type: 'recruitment', dates: { applicationStart: isoDate(1), applicationEnd: isoDate(5) } };
  assert.equal(L.recruitStatus(p), 'UPCOMING');
  assert.match(L.statusBadge(p), /लवकरच/);
  assert.equal(L.isClosed(p), false);
});

test('status: past deadline always wins over future start (bad data → CLOSED, never active)', async () => {
  const L = await libP;
  const p = { type: 'recruitment', dates: { applicationStart: isoDate(10), applicationEnd: isoDate(-1) } };
  assert.equal(L.recruitStatus(p), 'CLOSED');
  assert.equal(L.isClosed(p), true);
});

/* ---------- 3. Expired recruitment ---------- */
test('status: last date passed → CLOSED with अर्ज बंद badge', async () => {
  const L = await libP;
  const p = { type: 'recruitment', dates: { applicationEnd: isoDate(-2) } };
  assert.equal(L.recruitStatus(p), 'CLOSED');
  assert.equal(L.isClosed(p), true);
  assert.match(L.statusBadge(p), /अर्ज बंद/);
  assert.match(L.statusBadge(p), /data-status="CLOSED"/);
});

test('status: expired + admit card released → ADMIT_CARD', async () => {
  const L = await libP;
  const p = { type: 'recruitment', dates: { applicationEnd: isoDate(-2), admitCardDate: isoDate(-1) } };
  assert.equal(L.recruitStatus(p), 'ADMIT_CARD');
  assert.match(L.statusBadge(p), /प्रवेशपत्र उपलब्ध/);
});

test('status: result date passed → RESULT', async () => {
  const L = await libP;
  const p = { type: 'recruitment', dates: { applicationEnd: isoDate(-30), resultDate: isoDate(-1) } };
  assert.equal(L.recruitStatus(p), 'RESULT');
  assert.match(L.statusBadge(p), /निकाल जाहीर/);
});

test('status: application starts in future → UPCOMING', async () => {
  const L = await libP;
  const p = { type: 'recruitment', dates: { applicationStart: isoDate(5), applicationEnd: isoDate(30) } };
  assert.equal(L.recruitStatus(p), 'UPCOMING');
  assert.match(L.statusBadge(p), /लवकरच/);
});

/* ---------- 4. Missing last date ---------- */
test('status: missing applicationEnd treated as ACTIVE (per official notice)', async () => {
  const L = await libP;
  const p = { type: 'recruitment', dates: { applicationEnd: null, applicationStart: null } };
  assert.equal(L.recruitStatus(p), 'ACTIVE');
});

test('status: non-recruitment → null status, no badge', async () => {
  const L = await libP;
  assert.equal(L.recruitStatus({ type: 'current-affairs', dates: {} }), null);
  assert.equal(L.statusBadge({ type: 'current-affairs' }), '');
});

/* ---------- 5. Safe text extraction (Parts 8/22) ---------- */
test('safeText: XML node object → its text, never "System.Xml.XmlElement"', async () => {
  const L = await libP;
  assert.equal(L.safeText({ _: 'अधिकृत जाहिरात' }), 'अधिकृत जाहिरात');   // xml2js
  assert.equal(L.safeText({ '#text': 'नोटिस' }), 'नोटिस');                // fast-xml-parser
  assert.equal(L.safeText({ textContent: 'PIB' }), 'PIB');                // DOM
  const out = L.safeText({ 'System.Xml.XmlElement': {} });
  assert.equal(out, '');
  assert.ok(!/System\.Xml|XmlElement|\[object Object\]/.test(out));
});

test('safeText: nested XML node without a known text field → empty (no implicit String(obj))', async () => {
  const L = await libP;
  assert.equal(L.safeText({ a: { b: 'x' } }), '');
  assert.equal(L.safeText({}), '');
  assert.ok(!L.safeText({ a: {} }).includes('object'));
});

test('safeText: array → joined safe text', async () => {
  const L = await libP;
  assert.equal(L.safeText(['12वी', { textContent: 'Graduation' }, null]), '12वी, Graduation');
  assert.equal(L.safeText([]), '');
});

test('safeText: null / undefined / NaN → empty safe value', async () => {
  const L = await libP;
  assert.equal(L.safeText(null), '');
  assert.equal(L.safeText(undefined), '');
  assert.equal(L.safeText(NaN), '');
  assert.equal(L.safeText(Infinity), '');
  assert.equal(L.safeText(0), '0');
});

/* ---------- 6. Link trust (Parts 13/14/22) ---------- */
test('isOfficialUrl: only gov.in / nic.in hosts count as official', async () => {
  const L = await libP;
  assert.equal(L.isOfficialUrl('https://mpsc.gov.in/notice.pdf'), true);
  assert.equal(L.isOfficialUrl('https://www.mahapolice.gov.in'), true);
  assert.equal(L.isOfficialUrl('https://ssc.nic.in/'), true);
  assert.equal(L.isOfficialUrl('https://majhinaukri.com/job-1'), false);
  assert.equal(L.isOfficialUrl('https://fakegov.in.example.com'), false);
  assert.equal(L.isOfficialUrl('majhinaukri.com'), false);
  assert.equal(L.isOfficialUrl(''), false);
});

test('linkLabel: third-party source is labelled honestly', async () => {
  const L = await libP;
  assert.match(L.linkLabel('https://ssc.nic.in/'), /अधिकृत/);
  assert.match(L.linkLabel('https://someblog.example.com/'), /तृतीय-पक्ष/);
});

/* ---------- 7. Verified line (Part 5 — never fabricated) ---------- */
test('lastVerified: null unless a source really carries verifiedAt', async () => {
  const L = await libP;
  assert.equal(L.lastVerified({ sources: [{ url: 'https://x.gov.in', verifiedAt: null }] }), null);
  assert.equal(L.lastVerified({ sources: [] }), null);
  assert.equal(L.lastVerified({}), null);
  assert.equal(L.lastVerified({ sources: [{ verifiedAt: '2026-09-06T19:21:23Z' }, { verifiedAt: '2026-09-07T10:00:00Z' }] }), '2026-09-07');
});

/* ---------- 8. Breadcrumb must never link to a missing hub ---------- */
test('breadcrumbHtml: no category link when the hub page is not generated', async () => {
  const L = await libP;
  const out = L.breadcrumbHtml({ nameMr: 'MPSC', path: '/definitely-not-generated-hub/' });
  assert.ok(!out.includes('href="/definitely-not-generated-hub/"'));
  assert.match(out, /MPSC/);
  assert.equal(L.breadcrumbHtml(null), '<div class="breadcrumb"><a href="/">Home</a></div>');
});

/* ---------- 9. Formatting / escaping helpers ---------- */
test('fmtDate: ISO → DD-MM-YYYY, unknown formats → empty', async () => {
  const L = await libP;
  assert.equal(L.fmtDate('2026-09-15'), '15-09-2026');
  assert.equal(L.fmtDate('2026-09-15T10:00:00+05:30'), '15-09-2026');
  assert.equal(L.fmtDate(null), '');
  assert.equal(L.fmtDate('15/09/2026'), '');
});

test('esc: escapes HTML metacharacters (Part 20)', async () => {
  const L = await libP;
  assert.equal(L.esc('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  assert.equal(L.esc(null), '');
});
