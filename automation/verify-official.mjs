// Source Aggregation — Step 5: OFFICIAL VERIFICATION (docs/05 §5, §7, §24)
// §5: फक्त verified URLs; .gov.in/.nic.in preference; invent कधीच नाही.
// §7: conflict → priority (notification > authority > L2 > other); unresolvable → null + review.
// §24: HEAD/GET फक्त — CAPTCHA/login/anti-bot bypass कधीच नाही; fail → unavailable.
import { safeText } from './lib.mjs';

// ---------- Domain classification (§5) ----------
const OFFICIAL_RE = /(^|\.)(gov\.in|nic\.in|gov|nic\.in|edu\.in|ac\.in)$/i;
export function classifyUrl(url) {
  const u = safeText(url);
  if (!u) return { ok: false, official: false, reason: 'empty' };
  let parsed;
  try { parsed = new URL(u); } catch { return { ok: false, official: false, reason: 'not a url' }; }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { ok: false, official: false, reason: 'scheme must be http(s)' };
  const host = parsed.hostname.replace(/^www\./, '');
  const official = OFFICIAL_RE.test(host);
  return { ok: true, official, host, reason: official ? 'official government domain' : 'non-government host — official म्हणून label करू नये' };
}

// ---------- Conflict resolution (§7): वरील priority जिंकतो; समान priority + भिन्न value → conflict ----------
export function resolveConflict(candidates) {
  // candidates: [{ value, priority, sourceName }]
  const vals = candidates.filter(c => c.value != null && c.value !== '');
  if (!vals.length) return { value: null, conflict: false };
  const best = Math.min(...vals.map(v => v.priority));
  const top = vals.filter(v => v.priority === best);
  const unique = new Set(top.map(v => String(v.value)));
  if (unique.size === 1) return { value: top[0].value, conflict: vals.length > 1 && vals.some(v => String(v.value) !== String(top[0].value)) };
  // unresolvable → disputed field कधीच fact म्हणून publish नाही (§7)
  return { value: null, conflict: true, candidates: top };
}

// ---------- URL reachability (§24 — polite, no bypass) ----------
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
export async function checkUrl(url) {
  const cls = classifyUrl(url);
  if (!cls.ok) return { reachable: false, ...cls };
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow'
    });
    // 403/405 → HEAD reject असू शकते; एक GET शॉट (एकच, timeout सह — anti-bot कधीच bypass नाही)
    if (res.status === 403 || res.status === 405) {
      const g = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
      return { reachable: g.ok, status: g.status, ...cls };
    }
    return { reachable: res.ok, status: res.status, ...cls };
  } catch (e) {
    // network fail → unavailable mark (§24); fabricate कधीच नाही
    return { reachable: false, status: null, ...cls, reason: `unreachable: ${e.message}` };
  }
}

// ---------- Source tier (L1 > L2 > L3) ----------
// L1 = actual recruiting authority / official notification (official gov/edu domain OR priority 1)
// L2 = trusted government portal (priority 2, non-official host but gov-adjacent)
// L3 = third-party recruitment/job website (priority >= 3)
export function sourceTier(source) {
  const s = source || {};
  const pri = Number.isFinite(s.priority) ? s.priority : 4;
  const cls = classifyUrl(s.url || '');
  if (cls.official || pri <= 1) return 1;
  if (pri <= 2) return 2;
  return 3;
}

// Record-level verification: official/primary verification present?
// officialVerified = at least one L1/L2 source present (priority <= 2 or official domain).
// Third-party-only (all L3) → NOT verified → must stay in review queue (human approval + official check).
export function recordVerification(rec) {
  const sources = (rec && rec.sources) || [];
  const tiers = sources.map(sourceTier);
  const bestTier = tiers.length ? Math.min(...tiers) : 4;
  const officialVerified = tiers.some(t => t <= 2);
  const thirdPartyOnly = sources.length > 0 && tiers.every(t => t >= 3);
  return { bestTier, officialVerified, thirdPartyOnly, sourceCount: sources.length };
}
// ---------- Fake urgency + placeholder guard (§21) ----------
export const FAKE_URGENCY_RE = /(ताबडतोब|आताच अर्ज करा|last chance|limited slots|गोल्डन अपॉर्चुनिटी|golden opportunity)/i;
export const PLACEHOLDER_RE = /(\binferred\b|\bprobably\b|\bexpected\b|अंदाजे तारीख|unknown status)/i;
