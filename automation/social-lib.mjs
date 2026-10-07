// Social helpers — Instagram eligibility + deterministic caption + hashtags.
// फक्त published + indexable articles. Draft/under-review/archived/noindex → not eligible.
// Duplicate protection: social.instagram.status === 'published' → skip.
import { safeText } from './lib.mjs';

export const SHARE_CTA = '📲 मित्रांना शेअर करा';

export function socialEligibility(post) {
  if (!post) return { eligible: false, reason: 'missing post' };
  if (post.status !== 'published') return { eligible: false, reason: `status=${post.status}` };
  if (!post.seo || post.seo.index !== true) return { eligible: false, reason: 'noindex' };
  const st = post.social && post.social.instagram && post.social.instagram.status;
  if (st === 'published' || st === 'ready') return { eligible: false, reason: 'already posted/ready' };
  return { eligible: true, reason: 'published+indexable+fresh' };
}

function fmtNum(n) {
  return Number.isFinite(n) ? n.toLocaleString('en-IN') : '';
}
function lastDateMr(p) {
  const d = p.dates && p.dates.applicationEnd;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
  if (!m) return '';
  const MN = { '01': 'जानेवारी', '02': 'फेब्रुवारी', '03': 'मार्च', '04': 'एप्रिल', '05': 'मे', '06': 'जून', '07': 'जुलै', '08': 'ऑगस्ट', '09': 'सप्टेंबर', '10': 'ऑक्टोबर', '11': 'नोव्हेंबर', '12': 'डिसेंबर' };
  return `${+m[3]} ${MN[m[2]]} ${m[1]}`;
}

export function articleUrl(post, siteUrl) {
  const base = (siteUrl || 'https://marathiaura.in').replace(/\/$/, '');
  const p = post.path || ('/' + (post.slug || post.id) + '/');
  return base + p;
}

export function buildCaption(post, siteUrl) {
  const url = articleUrl(post, siteUrl);
  const lines = [];
  if (post.type === 'recruitment') {
    const r = post.recruitment || {};
    lines.push(`🔥 ${safeText(post.title)}`);
    lines.push('');
    if (post.content && post.content.shortDesc) lines.push(`📌 ${safeText(post.content.shortDesc).slice(0, 220)}`);
    lines.push('');
    const dept = safeText(post.department);
    if (dept) lines.push(`📍 संस्था: ${dept}`);
    const posts0 = (r.postNames || []).map(safeText).filter(Boolean).join(', ');
    if (posts0) lines.push(`📍 पद: ${posts0.slice(0, 120)}`);
    if (Number.isFinite(r.vacancies)) lines.push(`📍 जागा: ${fmtNum(r.vacancies)}`);
    const qual = (r.qualification || []).map(safeText).filter(Boolean).join(', ');
    if (qual) lines.push(`📍 पात्रता: ${qual.slice(0, 120)}`);
    const ld = lastDateMr(post);
    if (ld) lines.push(`📍 अर्जाची शेवटची तारीख: ${ld}`);
    lines.push('');
    lines.push('🌐 संपूर्ण माहिती:');
    lines.push(url);
    lines.push('');
    lines.push(SHARE_CTA);
    lines.push('');
    lines.push(hashtagsFor(post).join(' '));
  } else {
    lines.push(`📰 ${safeText(post.title)}`);
    lines.push('');
    if (post.content && post.content.shortDesc) lines.push(`${safeText(post.content.shortDesc).slice(0, 240)}`);
    lines.push('');
    lines.push('🌐 संपूर्ण माहिती:');
    lines.push(url);
    lines.push('');
    lines.push(SHARE_CTA);
    lines.push('');
    lines.push(hashtagsFor(post).join(' '));
  }
  return lines.join('\n').slice(0, 2000);
}

export function hashtagsFor(post) {
  const tags = ['#MarathiAura'];
  if (post.type === 'recruitment') {
    tags.push('#सरकारीभरती', '#सरकारीनोकरी', '#MaharashtraJobs', '#स्पर्धापरीक्षा');
  } else {
    tags.push('#CurrentAffairs', '#चालूघडामोडी', '#MPSC', '#स्पर्धापरीक्षा');
  }
  return [...new Set(tags)].slice(0, 8);
}
