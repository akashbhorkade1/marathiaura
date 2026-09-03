// Generates: ads.txt, robots.txt + copies assets/
import fs from 'node:fs';
import path from 'node:path';
import { loadSite, write, OUT, ROOT, esc } from '../lib.mjs';

const site = loadSite();

// ads.txt — AdSense crawler साठी (robots.txt कधीच block करत नाही)
if (site.adsense && site.adsense.enabled && site.adsense.publisherId) {
  const pub = site.adsense.publisherId.replace(/^ca-/, '');
  write('ads.txt', `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`);
  console.log('extras.mjs: ads.txt generated');
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
