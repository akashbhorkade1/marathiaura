// Source Aggregation — Step 2: NORMALIZE (docs/05-SOURCE-AGGREGATION.md §3)
// Raw source text → structured factual fields. Missing = null, कधीच infer/probably/expected नाही (§4).
// सर्व extraction rule-based — AI कधीच facts invent करू शकत नाही.
import { safeText } from './lib.mjs';

// ---------- Marathi + English month tables (IST dates, YYYY-MM-DD out) ----------
const MR_MONTHS = { 'जानेवारी': 1, 'फेब्रुवारी': 2, 'मार्च': 3, 'एप्रिल': 4, 'मे': 5, 'जून': 6, 'जुलै': 7, 'ऑगस्ट': 8, 'सप्टेंबर': 9, 'ऑक्टोबर': 10, 'नोव्हेंबर': 11, 'डिसेंबर': 12 };
const EN_MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

const pad2 = n => String(n).padStart(2, '0');
const iso = (y, m, d) => (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) ? `${y}-${pad2(m)}-${pad2(d)}` : null;

// ---------- Date parsing: ISO, DD-MM-YYYY, DD/MM/YYYY, "30 सप्टेंबर 2026", "September 30, 2026" ----------
export function parseDate(raw) {
  const s = safeText(raw);
  if (!s) return null;
  const ymd = s.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (ymd) return iso(+ymd[1], +ymd[2], +ymd[3]);
  const dmy = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  if (dmy) return iso(+dmy[3], +dmy[2], +dmy[1]);
  const MR_RE = new RegExp(`\\b(\\d{1,2})\\s+(${Object.keys(MR_MONTHS).join('|')})\\s+(20\\d{2})\\b`);
  const mr = s.match(MR_RE);
  if (mr) return iso(+mr[3], MR_MONTHS[mr[2]], +mr[1]);
  const EN_KEYS = Object.keys(EN_MONTHS).join('|');
  const enFirst = s.match(new RegExp(`\\b(${EN_KEYS})\\s+(\\d{1,2}),?\\s+(20\\d{2})\\b`, 'i')); // "September 30, 2026"
  if (enFirst) return iso(+enFirst[3], EN_MONTHS[enFirst[1].toLowerCase()], +enFirst[2]);
  const enLast = s.match(new RegExp(`\\b(\\d{1,2})\\s+(${EN_KEYS})\\s+(20\\d{2})\\b`, 'i')); // "30 September 2026"
  if (enLast) return iso(+enLast[3], EN_MONTHS[enLast[2].toLowerCase()], +enLast[1]);
  return null; // ओळखता आला नाही → null (guess कधीच नाही)
}

// ---------- Numeric/labelled field extraction ----------
export function parseVacancies(raw) {
  const s = safeText(raw);
  if (!s) return null;
  // "17,471 जागा" / "243 Nursing Officer posts" / "एकूण 4689 पदे" — फक्त explicit असतानाच.
  // आधी strict adjacency (4689 जागा), नंतर digit-free gap (243 Nursing Officer posts) —
  // "2026 च्या 4689 जागा" सारख्या मजकुरात चुकीचा year निवडू नये म्हणून gap मध्ये दुसरा number block.
  const kw = '(जागा|पदे?|posts?|vacanc\\w*|openings?|positions?)';
  const m = s.match(new RegExp(`(\\d[\\d,]{1,9})\\s*${kw}`, 'i'))
    || s.match(new RegExp(`(\\d[\\d,]{1,9})(?:(?!\\d)[^\\n]{0,40}?)\\s*${kw}`, 'i'));
  if (!m) return null;
  const n = parseInt((m[1] || m[2]).replace(/,/g, ''), 10);
  return Number.isFinite(n) && n > 0 && n < 10000000 ? n : null;
}

export function parseAdvtNo(raw) {
  const s = safeText(raw);
  if (!s) return null;
  const m = s.match(/(?:जाहिरात\s*(?:क्रमांक|क्र\.?|नं\.?)|advt\.?\s*(?:no\.?|number)?|advertisement\s*(?:no\.?|number)?)\s*[:\-–]?\s*([A-Z0-9][A-Z0-9/\-_.]{2,20})/i);
  return m ? m[1].replace(/[.,;]$/, '') : null;
}

export function parseAgeLimit(raw) {
  const s = safeText(raw);
  if (!s) return null;
  const m = s.match(/\b(\d{1,2})\s*(?:ते|to|-|–)\s*(\d{1,2})\s*(वर्ष|years?)/i);
  if (!m) return null;
  const min = +m[1], max = +m[2];
  return min >= 10 && max <= 60 && min < max ? { min, max, relaxation: null } : null;
}

export function parseFee(raw) {
  const s = safeText(raw);
  if (!s) return null;
  const m = s.match(/(?:शुल्क|fee|application fee)\w*[^₹0-9]{0,30}₹?\s*(\d[\d,]{1,6})/i);
  if (!m) return null;
  const n = parseInt(m[1].replace(/,/g, ''), 10);
  return Number.isFinite(n) && n >= 0 ? { general: n, reserved: null, note: null } : null;
}

export function parseOrganization(raw) {
  const s = safeText(raw);
  if (!s) return null;
  const m = s.match(/([^\n,.:;]{3,70}(?:विभाग|आयोग|मंडळ|Board|Commission|Corporation|University|Institute|Department|कार्यालय))(?:\s*(?:कडून|द्वारे|मार्फत|recruitment|invites))/i);
  return m ? m[1].trim() : null;
}

export function parsePostNames(raw) {
  const s = safeText(raw);
  if (!s) return [];
  const m = s.match(/(?:पदांसाठी|पदासाठी|पद:|posts? of|for the post of)\s+([^,.;\n]{3,60})/i)
    || s.match(/([A-Z][A-Za-z ]{3,50} (?:Officer|Constable|Assistant|Engineer|Clerk))/);
  const t = m ? m[1].trim() : '';
  return t && t.length >= 3 ? [t.slice(0, 80)] : [];
}

const QUAL_KWS = ['पदवी', 'डिग्री', '12 वी', '12वी', '10 वी', '10वी', 'HSC', 'SSC', 'graduation', 'graduate', 'diploma', 'इंजिनिअरी', 'B.E', 'B.Tech', 'MBA', 'MCA'];
export function parseQualification(raw) {
  const s = safeText(raw);
  if (!s) return [];
  return QUAL_KWS.filter(k => s.toLowerCase().includes(k.toLowerCase())).slice(0, 3);
}

// ---------- Category mapping (§19) — factual org/title keywords ----------
const CAT_MAP = [
  ['mpsc', ['mpsc', 'राज्यसेवा', 'लोकसेवा आयोग']],
  ['police-bharti', ['पोलीस', 'police', 'constable', 'सिपाही', 'srpf']],
  ['railway', ['रेल्वे', 'railway', 'rrb', 'ntpc']],
  ['banking', ['ibps', 'sbi', 'rbi', 'बँक', 'bank']],
  ['ssc', ['ssc', 'कर्मचारी निवड']],
  ['defence', ['संरक्षण', 'defence', 'army', 'navy', 'air force', 'इंडियन आर्मी']]
];
export function detectCategoryFacts(facts, fallback = 'latest-bharti') {
  const hay = `${facts.organization || ''} ${facts.recruitmentName || ''} ${facts.title || ''}`.toLowerCase();
  for (const [cat, kws] of CAT_MAP) if (kws.some(k => hay.includes(k))) return cat;
  return fallback; // source-provided category — contradiction आढळल्यास caller review flag करतो
}

// ---------- MAIN: raw item → normalized factual record (§4 full field list) ----------
export function normalizeFacts({ title, body, sourceUrl, sourceName, sourcePriority = 2, sourceType = 'html', retrievedAt }) {
  title = safeText(title);
  body = safeText(body);
  const text = `${title}. ${body}`.slice(0, 4000);
  const applicationEnd = parseDate(text);
  return {
    title,
    organization: parseOrganization(text),
    recruitmentName: title.slice(0, 120) || null,
    advtNo: parseAdvtNo(text),
    postNames: parsePostNames(text),
    vacancies: parseVacancies(text),
    qualification: parseQualification(text),
    ageLimit: parseAgeLimit(text),
    experience: null, // unstructured text मधून experience कधीच infer करू नये
    dates: {
      notification: null, applicationStart: null, applicationEnd,
      examDate: null, admitCardDate: null, resultDate: null
    },
    fee: parseFee(text),
    selectionProcess: [],
    salary: null,
    location: null,
    links: { notificationUrl: sourceUrl || null, applyUrl: null, officialUrl: null },
    source: { name: safeText(sourceName), url: sourceUrl || null, priority: sourcePriority, type: safeText(sourceType), retrievedAt: retrievedAt || new Date().toISOString() }
  };
}
