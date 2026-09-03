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
