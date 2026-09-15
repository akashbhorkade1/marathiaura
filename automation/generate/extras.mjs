// Generates: ads.txt, robots.txt + copies assets/
import fs from 'node:fs';
import path from 'node:path';
import { loadSite, write, OUT, ROOT, publisherId } from '../lib.mjs';

const site = loadSite();

// ads.txt — AdSense crawler साठी (robots.txt कधीच block करत नाही)
// Publisher ID कधीच public config मध्ये नाही — env: ADSENSE_PUB_ID (GitHub secret)
const pub = publisherId();
if (site.adsense && site.adsense.enabled && pub) {
  write('ads.txt', `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`);
  console.log('extras.mjs: ads.txt generated');
} else {
  console.log('extras.mjs: ads.txt SKIPPED (ADSENSE_PUB_ID env missing या adsense.enabled=false)');
}

// robots.txt — पूर्ण open, sitemap सूचित
write('robots.txt', `User-agent: *
Allow: /

Sitemap: ${site.url}/sitemap.xml
`);
console.log('extras.mjs: robots.txt generated');

// copy static assets
const srcAssets = path.join(ROOT, 'assets');
if (fs.existsSync(srcAssets)) {
  fs.cpSync(srcAssets, path.join(OUT, 'assets'), { recursive: true });
  console.log('extras.mjs: assets/ copied');
}

// redirects (docs/03 §7) — GitHub Pages native redirects नाहीत → meta-refresh stub + noindex
const redirectsPath = path.join(ROOT, 'data', 'redirects.json');
if (fs.existsSync(redirectsPath)) {
  let redirects = [];
  try { redirects = JSON.parse(fs.readFileSync(redirectsPath, 'utf8')).redirects || []; } catch { redirects = []; }
  for (const r of redirects) {
    if (!r || !r.from || !r.to) continue;
    const to = r.to.startsWith('http') ? r.to : site.url + r.to;
    write(r.from.replace(/^\//, '').replace(/\/$/, '') + '/index.html',
      `<!DOCTYPE html>\n<html lang="mr">\n<head>\n<meta charset="UTF-8">\n<meta name="robots" content="noindex, follow">\n<link rel="canonical" href="${to}">\n<meta http-equiv="refresh" content="0; url=${to}">\n<title>हलवले गेले आहे...</title>\n</head>\n<body>\n<p>हे पान हलवले गेले आहे. <a href="${to}">इथे क्लिक करा</a>.</p>\n</body>\n</html>\n`);
    console.log(`  redirect: ${r.from} → ${r.to}`);
  }
}

// GitHub Pages ला custom domain कळण्यासाठी deploy artifact मध्ये CNAME असणे आवश्यक आहे.
// Root मधील file copy केल्याने प्रत्येक fresh build नंतरही domain configuration टिकते.
const srcCname = path.join(ROOT, 'CNAME');
if (fs.existsSync(srcCname)) {
  fs.copyFileSync(srcCname, path.join(OUT, 'CNAME'));
  console.log('extras.mjs: CNAME copied');
}
