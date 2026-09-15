// Generates: sitemap index + category-wise sitemaps + search-index.json
import { loadSite, loadCategories, loadPosts, loadExams, loadTests, loadPages, published, write, writeJson, pathOf,
  safeText, recruitStatus, STATUS_META, questionIndex, isRenderableTest } from '../lib.mjs';

const site = loadSite();
const categories = loadCategories();
const posts = published(loadPosts());
const exams = published(loadExams());
const tests = loadTests();
const pages = loadPages();

function urlXml(loc, lastmod) {
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${(lastmod || new Date().toISOString()).slice(0, 10)}</lastmod>\n  </url>`;
}
function sitemapFile(name, entries) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
  write(name, xml);
  return { name, n: entries.length };
}
const mods = [];

// posts (genuine content only)
const postEntries = posts.filter(p => p.seo.index !== false)
  .map(p => urlXml(site.url + pathOf(p), p.lastUpdatedAt));
mods.push(sitemapFile('sitemap-posts.xml', postEntries));

// exams
mods.push(sitemapFile('sitemap-exams.xml', exams.map(e => urlXml(site.url + pathOf(e), e.lastUpdatedAt))));

// category indexes (only categories that will have generated pages)
const catEntries = [];
for (const c of categories) {
  if (c.id === 'latest-bharti') {
    if (posts.some(p => p.type === 'recruitment')) catEntries.push(urlXml(site.url + c.path, new Date().toISOString()));
  } else if (posts.some(p => p.category === c.id)) {
    catEntries.push(urlXml(site.url + c.path, new Date().toISOString()));
  }
}
mods.push(sitemapFile('sitemap-categories.xml', catEntries));
// mock tests — फक्त render होणारी test pages + listing hub (mock-test.mjs शी समान नियम)
const qIdx = questionIndex();
const renderableTests = tests.filter(t => isRenderableTest(t, qIdx));
const mockEntries = renderableTests.map(t => urlXml(site.url + pathOf(t), new Date().toISOString()));
if (renderableTests.length) mockEntries.unshift(urlXml(site.url + '/mock-test/', new Date().toISOString()));
mods.push(sitemapFile('sitemap-mocktests.xml', mockEntries));

// static pages
mods.push(sitemapFile('sitemap-static.xml', [
  urlXml(site.url + '/', new Date().toISOString()),
  ...pages.map(p => urlXml(`${site.url}/${p.id}/`, new Date().toISOString()))
].filter(Boolean)));

// sitemap index
const indexXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
  mods.map(m => `  <sitemap>\n    <loc>${site.url}/${m.name}</loc>\n    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>\n  </sitemap>`).join('\n')
}\n</sitemapindex>\n`;
write('sitemap.xml', indexXml);

// search index (client-side search) — फक्त indexable pages (noindex pages वगळा)
// Part 11: department / qualification / status / last date ने filter करता येईल अशी fields
writeJson('search-index.json', posts.filter(p => p.seo.index !== false).map(p => {
  const r = p.recruitment || {};
  const status = recruitStatus(p);
  return {
    title: p.title,
    desc: p.content.shortDesc,
    cat: (categories.find(c => c.id === p.category) || {}).nameMr || '',
    url: pathOf(p),
    type: p.type,
    dept: safeText(p.department),
    qual: (r.qualification || []).map(safeText).filter(Boolean).join(', '),
    location: safeText(r.location),
    status: status || '',
    statusLabel: status ? STATUS_META[status].label : '',
    lastDate: (p.dates && p.dates.applicationEnd) || ''
  };
}));

console.log(`sitemap.mjs: index + ${mods.map(m => `${m.name}(${m.n})`).join(', ')}`);
