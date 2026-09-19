// Source Aggregation — Step 6: ORIGINAL MARATHI GENERATION (docs/05 §8, §9, §14, §15)
// नियम (frozen): output फक्त normalized facts मधून येते. Source paragraph/copy कधीच वापरत नाही.
// हे copy-translation नाही — नवीन, छोटी, mobile-friendly मराठी article (§8 structure).
import { safeText, recruitStatus } from './lib.mjs';

const MR_MONTH_NAME = ['जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'];
export const fmtDateMr = isoDate => {
  const m = safeText(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${+m[3]} ${MR_MONTH_NAME[+m[2] - 1]} ${m[1]}` : '';
};

const STATUS_MR = { UPCOMING: 'लवकरच सुरू', ACTIVE: 'अर्ज सुरू', CLOSING_SOON: 'शेवटची तारीख जवळ', CLOSED: 'अर्ज बंद', ADMIT_CARD: 'प्रवेशपत्र उपलब्ध', RESULT: 'निकाल जाहीर' };

// ---------- §8 title: "[Recruitment Name] [Year]: [Post] भरती — [N] जागा" ----------
// Year फक्त dates.notification असतानाच — retrievedAt वरून year घेणे = guess (§4)
export function buildTitle(facts) {
  const nm = safeText(facts.dates && facts.dates.notification).match(/^(20\d{2})/);
  const org = safeText(facts.organization).replace(/(कडून|द्वारे|मार्फत)\s*$/, '') || safeText(facts.recruitmentName).slice(0, 60) || 'भरती';
  const post = safeText((facts.postNames || [])[0]);
  const vac = Number.isFinite(facts.vacancies) ? ` — ${facts.vacancies.toLocaleString('en-IN')} जागा` : '';
  return `${org}${nm ? ' ' + nm[1] : ''}${post ? ': ' + post + ' भरती' : ' भरती'}${vac}`.slice(0, 160);
}

// ---------- ShortDesc (§9: लहान वाक्ये, natural English terms) ----------
export function buildShortDesc(facts) {
  const end = fmtDateMr((facts.dates || {}).applicationEnd);
  const vac = Number.isFinite(facts.vacancies) ? `${facts.vacancies.toLocaleString('en-IN')} जागांसाठी` : 'जागांसाठी';
  const org = safeText(facts.organization) || safeText((facts.source || {}).name) || 'संबंधित संस्थेकडून';
  return `${org} कडून प्रकाशित भरती — ${vac} अर्ज मागवले आहेत.${end ? ` अर्ज करण्याची शेवटची तारीख ${end} आहे.` : ''} पात्रता, शुल्क आणि Official Notification खाली पहा.`.slice(0, 300);
}

// ---------- §8 sections — फक्त source-supported; filler paragraphs कधीच नाहीत (§15) ----------
export function buildSections(facts) {
  const d = facts.dates || {};
  const s = [];
  const org = safeText(facts.organization);
  const post = safeText((facts.postNames || [])[0]);
  const end = fmtDateMr(d.applicationEnd);
  s.push({
    heading: 'भरतीची थोडक्यात माहिती', type: 'list',
    items: [
      `संस्था: ${org || 'जाहिरात पहा'}`,
      post ? `पद: ${post}` : null,
      Number.isFinite(facts.vacancies) ? `जागा: ${facts.vacancies.toLocaleString('en-IN')}` : 'जागा: अधिकृत जाहिरातीत नमूद',
      (facts.qualification || []).length ? `पात्रता: ${facts.qualification.join(', ')}` : null,
      facts.ageLimit ? `वयोमर्यादा: ${facts.ageLimit.min} ते ${facts.ageLimit.max} वर्षे` : null,
      facts.fee && Number.isFinite(facts.fee.general) ? `अर्ज शुल्क: ₹${facts.fee.general.toLocaleString('en-IN')} (सामान्य)` : null,
      end ? `Last Date: ${end}` : 'Last Date: अधिकृत जाहिरातीत नमूद',
      `Status: ${STATUS_MR[recruitStatus({ type: 'recruitment', dates: d })] || 'जाहिरात पहा'}`
    ].filter(Boolean)
  });
  const why = [];
  if ((facts.qualification || []).length) why.push(`शैक्षणिक पात्रता: ${facts.qualification.join(', ')} असणे आवश्यक आहे.`);
  if (facts.ageLimit) why.push(`वय: ${facts.ageLimit.min} ते ${facts.ageLimit.max} वर्षे${facts.ageLimit.relaxation ? ` (${facts.ageLimit.relaxation})` : ''}.`);
  if (why.length) s.push({ heading: 'ही भरती तुमच्यासाठी आहे का?', type: 'text', body: why.join(' ') });
  const rows = [
    d.notification ? ['जाहिरात / Notification', fmtDateMr(d.notification)] : null,
    d.applicationStart ? ['अर्ज सुरू (Apply Online)', fmtDateMr(d.applicationStart)] : null,
    d.applicationEnd ? ['अर्जाची शेवटची तारीख (Last Date)', end] : null,
    d.examDate ? ['परीक्षा (Exam Date)', fmtDateMr(d.examDate)] : null,
    d.admitCardDate ? ['प्रवेशपत्र (Admit Card)', fmtDateMr(d.admitCardDate)] : null,
    d.resultDate ? ['निकाल (Result)', fmtDateMr(d.resultDate)] : null
  ].filter(Boolean);
  if (rows.length) s.push({ heading: 'महत्त्वाच्या तारखा', type: 'table', headers: ['कार्यक्रम', 'तारीख'], rows });
  if (facts.fee && Number.isFinite(facts.fee.general)) {
    s.push({ heading: 'अर्ज शुल्क', type: 'table', headers: ['प्रवर्ग', 'शुल्क'],
      rows: [['सामान्य / General', `₹${facts.fee.general.toLocaleString('en-IN')}`],
             ...(Number.isFinite(facts.fee.reserved) ? [['आरक्षित / Reserved', `₹${facts.fee.reserved.toLocaleString('en-IN')}`]] : []),
             ...(facts.fee.note ? [[facts.fee.note, '—']] : [])] });
  }
  const mode = safeText(facts.recruitment && facts.recruitment.applicationMode) || ((facts.links || {}).applyUrl ? 'Online' : null);
  if (mode === 'Online') {
    s.push({ heading: 'अर्ज कसा करायचा?', type: 'list', items: [
      'Official Notification PDF आधी पूर्ण वाचा (पात्रता, शुल्क, Last Date).',
      'Apply Online दुव्यावरून अर्ज भरा — आधार/ईमेल/मोबाइल तयार ठेवा.',
      'शुल्क पेमेंट केल्यानंतर confirmation page print किंवा PDF सेव्ह करा.'
    ] });
  }
  return s;
}

// ---------- Links section (§5, §13): फक्त verified, invent कधीच नाही ----------
export function buildLinksSection(facts) {
  const l = facts.links || {};
  const items = [
    l.notificationUrl ? `Notification: ${l.notificationUrl}` : null,
    l.applyUrl ? `Apply Online: ${l.applyUrl}` : null,
    l.officialUrl ? `Official Website: ${l.officialUrl}` : null
  ].filter(Boolean);
  return items.length ? items : null;
}

// ---------- Copy-detection (§21, §25#16): source text शी similarity gate ----------
export function shingleSimilarity(textA, textB, n = 5) {
  const sh = t => { const w = safeText(t).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean); const s = new Set(); for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(' ')); return s; };
  const A = sh(textA), B = sh(textB);
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
export const COPY_THRESHOLD = 0.45; // 5-gram Jaccard ≥ 0.45 → copied paragraph, FAIL (§14)
