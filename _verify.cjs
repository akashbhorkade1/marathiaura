// Verify rendered Naval Dockyard article page
const fs = require('fs');
const f = 'c:/Users/akash/marathiaura/_site/naval-dockyard-mumbai-apprentice-bharti-2026/index.html';
const h = fs.readFileSync(f, 'utf8');
const g = re => (h.match(re) || [])[1];
console.log('title :', g(/<title>([^<]*)<\/title>/).slice(0, 120));
console.log('metaD :', (g(/<meta name="description" content="([^"]*)"/) || '').slice(0, 200));
console.log('h1    :', (g(/<h1>([\s\S]*?)<\/h1>/) || '').replace(/<[^>]+>/g, '').slice(0, 120));
console.log('canon :', g(/rel="canonical" href="([^"]+)"/));
console.log('robots:', /name="robots" content="noindex/.test(h) ? 'NOINDEX (!!)' : 'indexable ok');
console.log('status:', g(/data-status="([A-Z_]+)"/));
console.log('bread :', (g(/<div class="breadcrumb">([\s\S]*?)<\/div>/) || '').replace(/<[^>]+>/g, ''));
console.log('H2s   :', [...h.matchAll(/<h2>([^<]*)<\/h2>/g)].map(m => m[1]).join(' | '));
const dl = [...h.matchAll(/<div class="dl-title">([^<]*)<\/div><\/div><a href="([^"]*)" target="_blank" rel="([^"]*)">([^<]*)/g)]
  .map(m => `${m[1]} -> ${m[2].slice(0, 75)} | rel=${m[3]} | btn=${m[4]}`);
console.log('DL cards:');
dl.forEach(c => console.log('   ' + c));
console.log('jsonld:', [...h.matchAll(/"@type":"?([A-Za-z]+)"?/g)].map(m => m[1]).join(','));
console.log('metaKeywords:', h.includes('meta name="keywords"') ? 'PRESENT (!!)' : 'absent ok');
console.log('dates ok:', h.includes('27-10-2026') && h.includes('283') ? 'last date + seats ok' : 'CHECK');
const sm = fs.readFileSync('c:/Users/akash/marathiaura/_site/sitemap-posts.xml', 'utf8');
console.log('sitemap:', sm.includes('naval-dockyard-mumbai-apprentice-bharti-2026') ? 'ok' : 'MISSING');
const home = fs.readFileSync('c:/Users/akash/marathiaura/_site/index.html', 'utf8');
console.log('homepage:', home.includes('naval-dockyard') ? 'ok (active job card)' : 'no');
const lb = fs.readFileSync('c:/Users/akash/marathiaura/_site/latest-bharti/index.html', 'utf8');
console.log('latest-bharti:', lb.includes('naval-dockyard') ? 'ok' : 'no');
const mh = fs.readFileSync('c:/Users/akash/marathiaura/_site/maharashtra-bharti/index.html', 'utf8');
console.log('maharashtra-bharti hub leak:', mh.includes('naval-dockyard') ? 'LEAKED (!!)' : 'none ok');