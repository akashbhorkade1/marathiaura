// Generates: post article pages + category index pages + OG images
import { loadSite, loadCategories, loadPosts, published, write, esc, pageHtml, postCard, svgOg, pathOf } from '../lib.mjs';

const site = loadSite();
const categories = loadCategories();
const posts = published(loadPosts());
const catById = Object.fromEntries(categories.map(c => [c.id, c]));
let count = 0;

function renderSection(sec) {
  if (!sec) return '';
  let inner = `<h2>${esc(sec.heading)}</h2>`;
  if (sec.type === 'text') inner += `<p>${esc(sec.body)}</p>`;
  else if (sec.type === 'table') {
    inner += '<table><thead><tr>' + (sec.headers || []).map(h => `<th>${esc(h)}</th>`).join('') + '</tr></thead><tbody>';
    for (const row of sec.rows || []) inner += '<tr>' + row.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>';
    inner += '</tbody></table>';
  } else if (sec.type === 'list') inner += '<ul>' + (sec.items || []).map(i => `<li>${esc(i)}</li>`).join('') + '</ul>';
  else if (sec.type === 'olist') inner += '<ol>' + (sec.items || []).map(i => `<li>${esc(i)}</li>`).join('') + '</ol>';
  return `<div class="content-section">${inner}</div>\n`;
}

function infoTable(p) {
  const r = p.recruitment || {};
  const rows = [
    ['विभाग', p.department],
    ['पदाचे नाव', (r.postNames || []).join(', ')],
    ['एकूण जागा', r.vacancies != null ? String(r.vacancies) : (r.vacanciesNote || 'माहिती अद्याप उपलब्ध नाही')],
    ['शैक्षणिक पात्रता', (r.qualification || []).join(', ')],
    ['वयोमर्यादा', r.ageLimit ? `${r.ageLimit.min} – ${r.ageLimit.max} वर्षे` : null],
    ['पगार', r.salary ? r.salary.payScale : null],
    ['अर्ज पद्धत', r.applicationMode],
    ['अर्जाची शेवटची तारीख', p.dates && p.dates.applicationEnd ? p.dates.applicationEnd : 'अधिकृत जाहिरातीत नमूद']
  ].filter(x => x[1]);
  return `<div class="content-section"><h2>एका नजरेत</h2>
  <table><tbody>${rows.map(x => `<tr><th>${esc(x[0])}</th><td>${esc(x[1])}</td></tr>`).join('')}</tbody></table></div>\n`;
}

function renderPost(p) {
  const cat = catById[p.category];
  const catName = cat ? cat.nameMr : 'अपडेट';
  const sections = (p.content.sections || []).map(renderSection).join('');
  const updates = (p.updates || []).length ? `<div class="content-section"><h2>अपडेट्स</h2><ul class="updates-list">${
    p.updates.map(u => `<li><span class="u-date">${esc((u.date || '').slice(0, 16).replace('T', ' '))}${u.type ? ' — ' + esc(u.type) : ''}</span><br><strong>${esc(u.title || '')}</strong>${u.summary ? '<br>' + esc(u.summary) : ''}</li>`).join('')
  }</ul></div>` : '';

  const faqs = (p.content.faqs || []);
  const faqHtml = faqs.length ? `<div class="content-section"><h2>वारंवार विचारले जाणारे प्रश्न</h2>${
    faqs.map(f => `<div class="faq-item"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join('')
  }</div>` : '';

  const links = [];
  if (p.links.notificationUrl) links.push(['सविस्तर जाहिरात / Notification', p.links.notificationUrl, 'जाहिरात पहा']);
  if (p.links.applyUrl) links.push(['ऑनलाइन अर्ज', p.links.applyUrl, 'अर्ज करा']);
  if (p.links.officialUrl) links.push(['अधिकृत संकेतस्थळ', p.links.officialUrl, 'अधिकृत website']);
  const linksHtml = links.length ? `<div class="content-section"><h2>महत्वाचे दुवे</h2>${
    links.map(l => `<div class="download-card"><div class="dl-info"><div class="dl-title">${esc(l[0])}</div></div><a href="${esc(l[1])}" target="_blank" rel="noopener">${esc(l[2])}</a></div>`).join('')
  }</div>` : '';

  const related = [];
  if (p.syllabusRef) related.push(`<a href="${esc(p.syllabusRef)}">अभ्यासक्रम</a>`);
  (p.relatedMockTests || []).forEach(t => related.push(`<a href="/mock-test/${esc(t)}/">मॉक टेस्ट</a>`));
  const relatedHtml = related.length ? `<div class="content-section"><h2>संबंधित माहिती</h2><p>${related.join(' · ')}</p></div>` : '';

  const sourceLink = (p.sources || []).find(s => s.url) || (p.links && p.links.officialUrl ? { url: p.links.officialUrl, name: 'अधिकृत संकेतस्थळ' } : null);
  const body = `
<div class="breadcrumb"><a href="/">Home</a> › <a href="${esc(cat ? cat.path : '/')}">${esc(catName)}</a></div>
<div class="page-header"><h1>${esc(p.title)}</h1></div>
<div class="last-updated">प्रकाशित: ${esc((p.publishedAt || '').slice(0, 10))} · अखेरचे अद्ययावत: ${esc((p.lastUpdatedAt || '').slice(0, 10))}</div>
<div class="highlight"><strong>थोडक्यात:</strong> ${esc(p.content.shortDesc)}</div>
${infoTable(p)}
${sections}
${updates}
${linksHtml}
${faqHtml}
${relatedHtml}
<div class="source-row">
  <span>स्रोत: ${sourceLink ? `<a href="${esc(sourceLink.url)}" target="_blank" rel="noopener">${esc(sourceLink.name)}</a>` : 'अधिकृत जाहिरात'}</span>
  <span>⚠ ही माहिती केवळ सर्वसाधारण मार्गदर्शनासाठी आहे. अंतिम व अचूक माहितीसाठी नेहमी अधिकृत जाहिरात तपासा.</span>
</div>`;

  const schemas = [];
  schemas.push(`{"@context":"https://schema.org","@type":"Article","headline":${JSON.stringify(p.title)},"datePublished":"${p.publishedAt}","dateModified":"${p.lastUpdatedAt}","author":{"@type":"Organization","name":"MarathiAura"},"mainEntityOfPage":"${site.url}${pathOf(p)}"}`);
  if (p.type === 'recruitment') {
    schemas.push(`{"@context":"https://schema.org","@type":"JobPosting","title":${JSON.stringify(p.title)},"description":${JSON.stringify(p.content.shortDesc)},"datePosted":"${(p.publishedAt || '').slice(0, 10)}","employmentType":"OTHER","hiringOrganization":{"@type":"Organization","name":${JSON.stringify(p.department || 'Official')}},"jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressCountry":"IN"}}}`);
  }
  if (faqs.length) {
    schemas.push(`{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[${faqs.map(f => `{"@type":"Question","name":${JSON.stringify(f.q)},"acceptedAnswer":{"@type":"Answer","text":${JSON.stringify(f.a)}}}`).join(',')}]}`);
  }
  write(pathOf(p).replace(/^\//, '') + 'index.html',
    pageHtml(site, categories, { title: p.title, description: p.content.metaDescription || p.content.shortDesc, canonical: site.url + pathOf(p), body, ogImage: p.seo.ogImage, type: 'article' })
      .replace('</head>', `<script type="application/ld+json">\n${schemas.join('\n')}\n</script>\n</head>`)
  );
  if (p.seo.ogImage) write(p.seo.ogImage.replace(/^\//, ''), svgOg(p.title, catName));
  count++;
  console.log(`  post: ${pathOf(p)}`);
}

for (const p of posts) {
  if (!p.path || !p.content || !p.content.shortDesc) { console.error(`  [SKIP] incomplete record: ${p.id}`); continue; }
  renderPost(p);
}

// Category index pages — फक्त जेव्हा category मध्ये प्रकाशित content आहे (thin page नियम)
for (const cat of categories) {
  if (cat.id === 'latest-bharti') continue; // वेगळ्या नावाने खाली
  const catPosts = posts.filter(p => p.category === cat.id)
    .sort((a, b) => String(b.lastUpdatedAt || '').localeCompare(String(a.lastUpdatedAt || '')));
  if (!catPosts.length) continue;
  const body = `
<div class="page-header"><h1>${esc(cat.nameMr)}</h1></div>
<p>${esc(cat.description)}</p>
<div class="post-list">
${catPosts.map(p => postCard(p, catById[p.category])).join('\n')}
</div>`;
  write(cat.path.replace(/^\//, '') + 'index.html',
    pageHtml(site, categories, { title: `${cat.nameMr} 2026 — ${cat.name}`, description: cat.description, canonical: site.url + cat.path, body }));
  console.log(`  category: ${cat.path} (${catPosts.length})`);
}

// /latest-bharti/ — सर्व recruitment updates (chronological)
const recPosts = posts.filter(p => p.type === 'recruitment')
  .sort((a, b) => String(b.lastUpdatedAt || '').localeCompare(String(a.lastUpdatedAt || '')));
if (recPosts.length) {
  const body = `
<div class="page-header"><h1>नवीन सरकारी भरती 2026</h1></div>
<p>सर्व नवीन सरकारी व महाराष्ट्र भरतींची अपडेट्स — जाहिरात, पात्रता, अर्ज आणि शेवटची तारीख.</p>
<div class="post-list">
${recPosts.map(p => postCard(p, catById[p.category])).join('\n')}
</div>`;
  write('latest-bharti/index.html',
    pageHtml(site, categories, { title: 'नवीन भरती 2026 — Latest Government Jobs', description: 'सर्व नवीन सरकारी भरती 2026 — जाहिरात, पात्रता, अर्ज आणि शेवटची तारीख.', canonical: site.url + '/latest-bharti/', body }));
  console.log(`  category: /latest-bharti/ (${recPosts.length})`);
}

console.log(`posts.mjs: ${count} article pages generated`);

