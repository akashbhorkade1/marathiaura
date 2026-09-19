// Source Aggregation — Step 4: DEDUPLICATE (docs/05-SOURCE-AGGREGATION.md §6, §27)
// एक recruitment = एक canonical MarathiAura record. Deterministic key + normalized-title fallback.
// कधीच तीन वेगळे articles बनवू नयेत त्याच recruitment साठी.
import { safeText } from './lib.mjs';

// ---------- Deterministic key: org|recruitmentName|advtNo|post|notificationUrl (normalized) ----------
const normPart = v => safeText(v).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
export function canonicalKey(facts) {
  const parts = [
    normPart(facts.organization),
    normPart(facts.recruitmentName),
    normPart(facts.advtNo),
    normPart((facts.postNames || [])[0]),
    normPart(facts.links && facts.links.notificationUrl)
  ];
  return parts.filter(Boolean).join('|') || null;
}

// ---------- Normalized title tokens + Jaccard similarity (secondary fallback) ----------
export function titleTokens(t) {
  return new Set(safeText(t).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2));
}
export function titleSimilarity(a, b) {
  const A = titleTokens(a), B = titleTokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}
export const SIM_THRESHOLD = 0.62; // जास्त कमी ठेवला तर false merge, जास्त जास्त तर duplicate slip

// ---------- Canonical matcher (§6): exact key → strong; title-similarity fallback → confirmatory ----------
// Fallback merge फक्त तेव्हाच जेव्हा title सारखेच असेल **आणि** किमान एक hard fact (advt/vacancies) जुळेल —
// false merge टाळण्यासाठी (§27: quality > quantity).
export function findCanonical(facts, records) {
  const key = canonicalKey(facts);
  if (key) {
    const exact = records.find(r => canonicalKey(factsFromRecord(r)) === key);
    if (exact) return { record: exact, method: 'key' };
  }
  for (const r of records) {
    const rf = factsFromRecord(r);
    if (titleSimilarity(facts.title, rf.title) < SIM_THRESHOLD) continue;
    const advtMatch = facts.advtNo && facts.advtNo === rf.advtNo;
    const vacMatch = Number.isFinite(facts.vacancies) && facts.vacancies === rf.vacancies;
    if (advtMatch || vacMatch) return { record: r, method: 'title-fallback' };
  }
  return null;
}

// existing record → facts shape (Schema V2 record मधून)
export function factsFromRecord(r) {
  return {
    title: r.title,
    organization: r.department || r.organization || null,
    recruitmentName: r.title,
    advtNo: r.advtNo || null,
    postNames: (r.recruitment && r.recruitment.postNames) || [],
    vacancies: r.recruitment ? r.recruitment.vacancies : null,
    dates: r.dates || {},
    links: r.links || {}
  };
}

// ---------- Cross-source merge (§6, §16): दोन्ही source चे provenance जपून, एकच record ----------
export function mergeFacts(base, incoming) {
  // priority: खालचा number = जास्त trusted. उच्च priority चा non-null field जिंकतो.
  const pri = f => (f.source && Number.isFinite(f.source.priority)) ? f.source.priority : 4;
  const take = (b, i, path) => {
    const bv = b[path], iv = i[path];
    if (iv == null) return bv;
    if (bv == null) return iv;
    return pri(i) <= pri(b) ? iv : bv;
  };
  const merged = { ...base };
  merged.organization = take(base, incoming, 'organization');
  merged.advtNo = take(base, incoming, 'advtNo');
  merged.vacancies = take(base, incoming, 'vacancies');
  merged.qualification = (incoming.qualification || []).length >= (base.qualification || []).length ? incoming.qualification : base.qualification;
  merged.ageLimit = take(base, incoming, 'ageLimit');
  merged.fee = take(base, incoming, 'fee');
  merged.dates = { ...base.dates };
  for (const k of Object.keys(merged.dates)) {
    const iv = incoming.dates && incoming.dates[k];
    if (iv && (!merged.dates[k] || (incoming.source && incoming.source.priority <= (base.source ? base.source.priority : 4)))) merged.dates[k] = iv;
  }
  return merged;
}
