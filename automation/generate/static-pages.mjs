// Generates: trust pages (About, Contact, Privacy, Terms, Disclaimer, Editorial Policy) + Search + 404
import { loadSite, loadCategories, loadPages, write, esc, pageHtml } from '../lib.mjs';

const site = loadSite();
const categories = loadCategories();
const pages = loadPages();

for (const pg of pages) {
  const body = `
<div class="page-header"><h1>${esc(pg.title)}</h1></div>
<div class="content-section">${pg.body}</div>`;
  write(pg.id + '/index.html', pageHtml(site, categories, {
    title: `${pg.title} — MarathiAura`,
    description: `${pg.title} — MarathiAura (marathiaura.in)`,
    canonical: `${site.url}/${pg.id}/`,
    body
  }));
  console.log(`  page: /${pg.id}/`);
}

// Search page (client-side over /search-index.json; noindex)
const searchBody = `
<div class="page-header"><h1>शोधा</h1></div>
<div class="search-box" style="padding:0 0 16px">
  <input type="search" id="q" placeholder="भरती, निकाल, अभ्यासक्रम शोधा..." aria-label="Search">
</div>
<div class="post-list" id="results"><p>वर टाइप करून शोधा — उदा. "police", "talathi", "निकाल".</p></div>
<script>
(function(){
  var el = document.getElementById('q'), out = document.getElementById('results');
  var idx = null;
  fetch('/search-index.json').then(function(r){return r.json()}).then(function(d){idx=d});
  function run(){
    var q = (el.value||'').toLowerCase().trim();
    if(!idx) return;
    if(q.length < 2){ out.innerHTML = '<p>वर टाइप करून शोधा.</p>'; return; }
    var hits = idx.filter(function(p){
      return (p.title+' '+(p.desc||'')+' '+(p.cat||'')).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 20);
    out.innerHTML = hits.length ? hits.map(function(p){
      return '<a class="post-card" href="'+p.url+'"><div><span class="badge-cat">'+(p.cat||'')+'</span></div><div class="title">'+p.title+'</div></a>';
    }).join('') : '<p>कोणतेही निकाल सापडले नाहीत.</p>';
  }
  el.addEventListener('input', run);
})();
</script>`;
write('search.html', pageHtml(site, categories, {
  title: 'शोधा — MarathiAura',
  description: 'MarathiAura वर भरती, निकाल, अभ्यासक्रम शोधा.',
  canonical: site.url + '/search.html',
  body: searchBody,
  index: false
}));
console.log('  page: /search.html (noindex)');

// 404
const body404 = `
<div class="page-header"><h1>404 — पान सापडले नाही</h1></div>
<div class="content-section">
<p>तुम्ही शोधत असलेले पान उपलब्ध नाही किंवा हलवले गेले आहे.</p>
<p><a class="btn btn-primary" href="/">Homepage वर जा</a></p>
</div>`;
write('404.html', pageHtml(site, categories, {
  title: 'पान सापडले नाही (404) — MarathiAura',
  description: 'पान उपलब्ध नाही.',
  canonical: site.url + '/404.html',
  body: body404,
  index: false
}));
console.log('  page: /404.html');
