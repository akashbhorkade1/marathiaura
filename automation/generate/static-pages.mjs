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
<div class="search-box search-filters" style="padding:0 0 12px">
  <input type="search" id="q" placeholder="भरती, निकाल, अभ्यासक्रम शोधा... (उदा. 12वी भरती, Police, Talathi, Bank)" aria-label="Search" autocomplete="off">
  <select id="status" aria-label="अर्ज स्थिती">
    <option value="">सर्व स्थिती</option>
    <option value="ACTIVE">🟢 अर्ज सुरू</option>
    <option value="CLOSING_SOON">🟠 शेवटची तारीख जवळ</option>
    <option value="UPCOMING">🔜 लवकरच</option>
    <option value="CLOSED">🔴 अर्ज बंद</option>
    <option value="ADMIT_CARD">🔵 प्रवेशपत्र</option>
    <option value="RESULT">🏆 निकाल</option>
  </select>
  <button type="button" id="go">शोधा</button>
</div>
<div class="post-list" id="results"><p>वर टाइप करून शोधा — उदा. "police", "talathi", "12वी भरती", "Last Date".</p></div>
<script>
(function(){
  var qEl = document.getElementById('q'), sEl = document.getElementById('status'), out = document.getElementById('results');
  var idx = null;
  function esc(s){
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  var CLS = { ACTIVE:'badge-active', CLOSING_SOON:'badge-closing', UPCOMING:'badge-upcoming', CLOSED:'badge-closed', ADMIT_CARD:'badge-admit', RESULT:'badge-result' };
  function isClosed(p){ return p.status === 'CLOSED' || p.status === 'ADMIT_CARD' || p.status === 'RESULT'; }
  function hay(p){
    return [p.title, p.desc, p.cat, p.dept, p.qual, p.location, p.statusLabel, p.type].join(' ').toLowerCase();
  }
  function card(p){
    var badge = p.statusLabel ? ' <span class="badge ' + (CLS[p.status] || 'badge-active') + '">' + esc(p.statusLabel) + '</span>' : '';
    var meta = [];
    if (p.lastDate) meta.push('शेवटची तारीख: ' + esc(p.lastDate));
    if (p.dept) meta.push(esc(p.dept));
    return '<a class="post-card' + (isClosed(p) ? ' is-closed' : '') + '" href="' + esc(p.url) + '">' +
      '<div><span class="badge-cat">' + esc(p.cat || 'अपडेट') + '</span></div>' +
      '<div class="title">' + esc(p.title) + badge + '</div>' +
      (meta.length ? '<div class="meta">' + meta.join(' · ') + '</div>' : '') + '</a>';
  }
  var HINT = '<p>वर टाइप करून शोधा — उदा. "police", "talathi", "12वी भरती", "Last Date".</p>';
  function render(){
    if (!idx) return;
    var q = (qEl.value || '').toLowerCase().trim(), st = sEl.value;
    if (!q && !st) { out.innerHTML = HINT; return; }
    var hits = idx.filter(function(p){
      if (st && p.status !== st) return false;
      return !q || hay(p).indexOf(q) !== -1;
    });
    hits.sort(function(a, b){ return (isClosed(a) ? 1 : 0) - (isClosed(b) ? 1 : 0); });
    var shown = hits.slice(0, 30);
    out.innerHTML = shown.length
      ? shown.map(card).join('') + (hits.length > shown.length ? '<p class="empty-state">अजून ' + (hits.length - shown.length) + ' निकाल आहेत — शोध अधिक विशिष्ट करा.</p>' : '')
      : '<p class="empty-state">कोणतेही निकाल सापडले नाहीत. वेगळा शब्द किंवा स्थिती निवडून पहा.</p>';
  }
  var initial = new URLSearchParams(location.search).get('q');
  fetch('/search-index.json').then(function(r){ return r.json(); }).then(function(d){
    idx = d;
    if (initial) qEl.value = initial;
    render();
  }).catch(function(){ out.innerHTML = '<p class="empty-state">शोध सध्या उपलब्ध नाही — कृपया पुन्हा प्रयत्न करा.</p>'; });
  qEl.addEventListener('input', render);
  sEl.addEventListener('change', render);
  document.getElementById('go').addEventListener('click', render);
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
