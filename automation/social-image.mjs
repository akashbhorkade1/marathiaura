// Social image — deterministic 1080×1350 (4:5) SVG template, article facts only.
// No AI image generation. Same facts → same poster. Fabrication नाही:
// image text फक्त article JSON मधून; unknown fields omit.
// Instagram publish च्यासाठी SVG ऐवजी वैध JPEG (.jpg) आवश्यक.
import { safeText, esc } from './lib.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const SOCIAL_W = 1080;
export const SOCIAL_H = 1350;

// JPEG SOI marker: FF D8 FF
export function isValidJpeg(buf) {
  return Buffer.isBuffer(buf) && buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
}

// SVG → JPEG (1080×1350, 4:5) using ImageMagick convert पर ubuntu-latest GH Actions runner.
// convert SVG ला rasterize करून JPEG तयार करते. Output चा MIME type image/jpeg असल्याची खात्री करतो.
export function socialJpeg(post) {
  const svg = socialSvg(post);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marathiaura-social-'));
  try {
    const svgPath = path.join(tmpDir, 'post.svg');
    const jpgPath = path.join(tmpDir, 'post.jpg');
    fs.writeFileSync(svgPath, svg, 'utf8');

    execFileSync('convert', [
      svgPath,
      '-resize', `${SOCIAL_W}x${SOCIAL_H}!`,
      '-quality', '90',
      '-colorspace', 'sRGB',
      jpgPath
    ], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });

    const buf = fs.readFileSync(jpgPath);
    if (!isValidJpeg(buf)) {
      throw new Error('convert output is not a valid JPEG (missing FFD8FF SOI marker)');
    }
    return buf;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function wrap(text, max) {
  const words = safeText(text).split(/\s+/).filter(Boolean);
  const lines = []; let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (next.length > max) { if (cur) lines.push(cur); cur = w; }
    else cur = next;
    if (lines.length >= 4) break;
  }
  if (cur && lines.length < 4) lines.push(cur);
  return lines.slice(0, 4);
}

export function socialSvg(post) {
  const title = safeText(post.title).slice(0, 140);
  const lines = wrap(title, 22);
  const isRec = post.type === 'recruitment';
  const r = post.recruitment || {};
  const vac = isRec && Number.isFinite(r.vacancies) ? r.vacancies.toLocaleString('en-IN') : null;
  const post0 = isRec ? safeText((r.postNames || [])[0]).slice(0, 60) : '';
  const qual = isRec ? safeText((r.qualification || []).join(', ')).slice(0, 60) : '';
  const ld = (() => {
    const d = post.dates && post.dates.applicationEnd;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
    if (!m) return '';
    const MN = { '01': 'जानेवारी', '02': 'फेब्रुवारी', '03': 'मार्च', '04': 'एप्रिल', '05': 'मे', '06': 'जून', '07': 'जुलै', '08': 'ऑगस्ट', '09': 'सप्टेंबर', '10': 'ऑक्टोबर', '11': 'नोव्हेंबर', '12': 'डिसेंबर' };
    return `शेवटची तारीख: ${+m[3]} ${MN[m[2]]} ${m[1]}`;
  })();
  const period = !isRec && post.period
    ? (post.period.month || `${post.period.start || ''} ते ${post.period.end || ''}`)
    : '';
  let y = 470;
  const titleSvg = lines.map(ln => {
    const s = `<text x="80" y="${y}" font-family="Arial,sans-serif" font-size="56" fill="#ffffff" font-weight="bold">${esc(ln)}</text>`;
    y += 74; return s;
  }).join('\n');
  const factRows = [];
  if (isRec && vac) factRows.push(`🔢 ${vac} जागा`);
  if (isRec && post0) factRows.push(`💼 ${post0}`);
  if (isRec && ld) factRows.push(`📅 ${ld}`);
  if (isRec && qual) factRows.push(`🎓 ${qual}`);
  if (!isRec && period) factRows.push(`🗓️ ${period}`);
  const factsSvg = factRows.slice(0, 4).map((f, i) =>
    `<text x="80" y="${880 + i * 62}" font-family="Arial,sans-serif" font-size="38" fill="#ffe0b2">${esc(f)}</text>`
  ).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SOCIAL_W}" height="${SOCIAL_H}">
<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#0c447c"/><stop offset="100%" style="stop-color:#2074b8"/></linearGradient></defs>
<rect width="1080" height="1350" fill="url(#bg)"/>
<rect width="1080" height="10" fill="#ff6f00"/>
<text x="80" y="150" font-family="Arial,sans-serif" font-size="44" fill="#ff6f00" font-weight="bold">MarathiAura</text>
<text x="80" y="210" font-family="Arial,sans-serif" font-size="30" fill="#dce8f5">${esc(isRec ? 'सरकारी भरती' : 'चालू घडामोडी')}</text>
<rect x="80" y="250" width="120" height="5" fill="#ff6f00"/>
${titleSvg}
${factsSvg}
<rect x="80" y="1150" width="920" height="2" fill="#ff6f00" opacity="0.6"/>
<text x="80" y="1210" font-family="Arial,sans-serif" font-size="34" fill="#ffffff">marathiaura.in</text>
<text x="80" y="1260" font-family="Arial,sans-serif" font-size="28" fill="#a8c8e8">📲 मित्रांना शेअर करा</text>
</svg>`;
}
