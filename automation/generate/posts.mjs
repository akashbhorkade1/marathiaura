// Generates: post article pages + category index pages + OG images
import { loadSite, loadCategories, loadPosts, published, write, esc, pageHtml, postCard, svgOg, pathOf,
  safeText, statusBadge, recruitStatus, isClosed, fmtDate, lastVerified, isOfficialUrl, breadcrumbHtml, STATUS_META } from '../lib.mjs';

const site = loadSite();
const categories = loadCategories();
const posts = published(loadPosts());
const catById = Object.fromEntries(categories.map(c => [c.id, c]));
let count = 0;

function renderSection(sec) {
  if (!sec) return '';
  const heading = safeText(sec.heading);
  let inner = `<h2>${esc(heading || 'माहिती')}</h2>`;
  if (sec.type === 'text') {
    const body = safeText(sec.body);
    if (!body) return ''; // empty section → render कधीच नाही (no empty HTML placeholders)
    inner += `<p>${esc(body)}</p>`;
  } else if (sec.type === 'table') {
    const rows = (sec.rows || []).map(r => (r || []).map(c => safeText(c)));
    if (!rows.length) return '';
    inner += '<table><thead><tr>' + (sec.headers || []).map(h => `<th>${esc(safeText(h))}</th>`).join('') + '</tr></thead><tbody>';
    for (const row of rows) inner += '<tr>' + row.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>';
    inner += '</tbody></table>';
  } else if (sec.type === 'list') {
    const items = (sec.items || []).map(safeText).filter(Boolean);
    if (!items.length) return '';
    inner += '<ul>' + items.map(i => `<li>${esc(i)}</li>`).join('') + '</ul>';
  } else if (sec.type === 'olist') {
    const items = (sec.items || []).map(safeText).filter(Boolean);
    if (!items.length) return '';
    inner += '<ol>' + items.map(i => `<li>${esc(i)}</li>`).join('') + '</ol>';
  }
  return `<div class="content-section">${inner}</div>\n`;
}

function feeText(r) {
  if (!r.fee) return null;
  const parts = [];
  if (r.fee.general != null) parts.push(`सामान्य: ₹${r.fee.general}`);
  if (r.fee.reserved != null) parts.push(`आरक्षित: ₹${r.fee.reserved}`);
  const note = safeText(r.fee.note);
  if (note) parts.push(note);
  return parts.join(' · ') || null;
}

// जागा संख्या — number/string तर वापर, अन्यथा safeText (object → "[object Object]" कधीच नाही)
function vacancyText(r) {
  if (typeof r.vacancies === 'number') return String(r.vacancies);
  return safeText(r.vacancies) || safeText(r.vacanciesNote) || null;
}

function infoTable(p) {
  const r = p.recruitment || {};
  const st = recruitStatus(p);
  const rows = [
    ['🟢 Status', st ? `${STATUS_META[st].icon} ${STATUS_META[st].label}` : null],
    ['🏢 संस्था / विभाग', safeText(p.department)],
    ['💼 पद', (r.postNames || []).map(safeText).filter(Boolean).join(', ')],
    ['🔢 एकूण जागा', vacancyText(r)],
    ['🎓 शैक्षणिक पात्रता', (r.qualification || []).map(safeText).filter(Boolean).join(', ')],
    ['🎂 वयोमर्यादा', r.ageLimit && r.ageLimit.max != null ? `${r.ageLimit.min} – ${r.ageLimit.max} वर्षे${r.ageLimit.relaxation ? ' (' + safeText(r.ageLimit.relaxation) + ')' : ''}` : null],
    ['💰 अर्ज शुल्क', feeText(r)],
    ['📍 नोकरीचे ठिकाण', safeText(r.location)],
    ['🗓 अर्ज पद्धत', safeText(r.applicationMode)],
    ['📅 अर्जाची शेवटची तारीख', p.dates && p.dates.applicationEnd ? fmtDate(p.dates.applicationEnd) : 'अधिकृत जाहिरातीत नमूद']
  ].filter(x => x[1]);
  return `<div class="content-section"><h2>एका नजरेत (At a Glance)</h2>
  <table><tbody>${rows.map(x => `<tr><th>${esc(x[0])}</th><td>${esc(x[1])}</td></tr>`).join('')}</tbody></table></div>\n`;
}

function datesTable(p) {
  const d = p.dates || {};
  const labels = { notification: 'जाहिरात', applicationStart: 'अर्ज सुरू', applicationEnd: 'अर्जाची शेवटची तारीख', examDate: 'परीक्षा', admitCardDate: 'प्रवेशपत्र', resultDate: 'निकाल' };
  const rows = Object.entries(labels)
    .filter(([k]) => d[k])
    .map(([k, label]) => `<tr><th>${label}</th><td>${fmtDate(d[k])}</td></tr>`);
  if (!rows.length) return '';
  return `<div class="content-section"><h2>महत्त्वाच्या तारखा</h2>
  <table><tbody>${rows.join('')}</tbody></table></div>\n`;
}

// "ही भरती तुमच्यासाठी आहे का?" — फक्त source-supported fields वरून checklist
function checklistHtml(p) {
  const r = p.recruitment || {};
  const checks = [];
  for (const q of (r.qualification || [])) if (safeText(q)) checks.push(`पात्रता: ${safeText(q)}`);
  if (r.ageLimit && r.ageLimit.max != null) checks.push(`वय: ${r.ageLimit.min} – ${r.ageLimit.max} वर्षे (जाहिरातीतील दिनांकानुसार)`);
  if (safeText(r.applicationMode)) checks.push(`अर्ज पद्धत: ${safeText(r.applicationMode)}`);
  if (safeText(r.location)) checks.push(`नोकरीचे ठिकाण: ${safeText(r.location)}`);
  if (!checks.length) return '';
  return `<div class="content-section"><h2>ही भरती तुमच्यासाठी आहे का? 👀</h2>
  <ul>${checks.map(c => `<li>✅ ${esc(c)}</li>`).join('')}</ul>
  <p><small>अंतिम निकषांसाठी अधिकृत जाहिरात नक्की वाचा.</small></p></div>\n`;
}

// वेतन / Pay Scale — फक्त source मध्ये salary (payScale/note) असेल तरच (Part 6)
function salaryHtml(p) {
  const s = (p.recruitment || {}).salary;
  const scale = safeText(s && (s.payScale || s.scale || s.amount))
    || (typeof s === 'string' ? safeText(s) : '');
  const note = safeText(s && s.note);
  if (!scale && !note) return '';
  return `<div class="content-section"><h2>वेतन / Pay Scale</h2>
  ${scale ? `<p><strong>${esc(scale)}</strong></p>` : ''}
  ${note ? `<p><small>${esc(note)}</small></p>` : ''}</div>\n`;
}

// निवड प्रक्रिया — source selectionProcess[] वरून (Part 6)
function selectionHtml(p) {
  const items = (p.selectionProcess || []).map(safeText).filter(Boolean);
  if (!items.length) return '';
  return `<div class="content-section"><h2>निवड प्रक्रिया</h2>
  <ol>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ol></div>\n`;
}

// अर्ज कसा करायचा? — फक्त source-supported fields (applicationMode / applyUrl / fee / शेवटची तारीख)
function howToApplyHtml(p, closed) {
  const r = p.recruitment || {};
  const mode = safeText(r.applicationMode);
  const apply = (p.links && /^https?:\/\//.test(p.links.applyUrl || '')) ? p.links.applyUrl : null;
  if (!mode && !apply) return '';
  const steps = [];
  if (mode) steps.push(`अर्ज पद्धत: ${mode}`);
  const fee = feeText(r);
  if (fee) steps.push(`अर्ज शुल्क: ${fee}`);
  if (p.dates && p.dates.applicationEnd) steps.push(`अर्ज करण्याची शेवटची तारीख: ${fmtDate(p.dates.applicationEnd)}`);
  steps.push(closed
    ? 'अर्ज प्रक्रिया पूर्ण झाली आहे — लिंक फक्त संदर्भासाठी'
    : 'अधिकृत अर्ज लिंकवरूनच अर्ज करा (खालील महत्त्वाच्या लिंक्स पहा)');
  return `<div class="content-section"><h2>अर्ज कसा करायचा?</h2>
  <ol>${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
  <p><small>कोणत्याही मध्यस्थाला पैसे देऊ नका. अर्ज नेहमी अधिकृत संकेतस्थळावरूनच करा.</small></p></div>\n`;
}

// कोणती कागदपत्रे लागतील? — फक्त source मध्ये documents[] असेल तरच (कधीच invent नाही)
function documentsHtml(p) {
  const raw = p.documents || (p.recruitment && p.recruitment.documents) || [];
  const items = (Array.isArray(raw) ? raw : [raw]).map(safeText).filter(Boolean);
  if (!items.length) return '';
  return `<div class="content-section"><h2>कोणती कागदपत्रे लागतील?</h2>
  <ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
  <p><small>कागदपत्रांची अंतिम यादी अधिकृत जाहिरातीत दिलेली आहे.</small></p></div>\n`;
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

  // महत्त्वाच्या लिंक्स (Part 13) — फक्त notification / apply / official; फक्त http(s);
  // शेवटची तारीख उलटून गेली असल्यास Apply link "संदर्भासाठी" म्हणून (page ऐतिहासिक राहतो)
  const closed = isClosed(p);
  const lk = p.links || {};
  const links = [];
  if (lk.notificationUrl && /^https?:\/\//.test(lk.notificationUrl)) {
    const official = isOfficialUrl(lk.notificationUrl);
    links.push([official ? 'अधिकृत जाहिरात / Notification' : 'माहिती स्रोत (तृतीय-पक्ष)', lk.notificationUrl,
      official ? 'जाहिरात पहा' : 'स्रोत पहा', official]);
  }
  if (lk.applyUrl && /^https?:\/\//.test(lk.applyUrl)) {
    links.push(['Apply Online (अर्ज)', lk.applyUrl, closed ? 'अर्ज बंद — संदर्भासाठी' : 'अर्ज करा', isOfficialUrl(lk.applyUrl)]);
  }
  if (lk.officialUrl && /^https?:\/\//.test(lk.officialUrl)) {
    links.push(['अधिकृत संकेतस्थळ / Official Website', lk.officialUrl, 'Official Website', isOfficialUrl(lk.officialUrl)]);
  }
  const linksHtml = links.length ? `<div class="content-section"><h2>महत्त्वाच्या लिंक्स</h2>${
    links.map(l => `<div class="download-card"><div class="dl-info"><div class="dl-title">${esc(l[0])}</div></div><a href="${esc(l[1])}" target="_blank" rel="noopener${l[3] ? '' : ' nofollow'}">${esc(l[2])}</a></div>`).join('')
  }</div>` : '';

  const related = [];
  if (p.syllabusRef) related.push(`<a href="${esc(p.syllabusRef)}">अभ्यासक्रम</a>`);
  (p.relatedMockTests || []).forEach(t => related.push(`<a href="/mock-test/${esc(t)}/">मॉक टेस्ट</a>`));
  const relatedHtml = related.length ? `<div class="content-section"><h2>संबंधित माहिती</h2><p>${related.join(' · ')}</p></div>` : '';

  // स्रोत (Part 14) — सर्व sources[] स्पष्टपणे; official vs तृतीय-पक्ष वेगळे
  const srcList = (p.sources || []).filter(s => s && s.url && /^https?:\/\//.test(s.url));
  const sourceHtml = srcList.length
    ? srcList.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener${isOfficialUrl(s.url) ? '' : ' nofollow'}">${esc(safeText(s.name) || s.url)}${isOfficialUrl(s.url) ? '' : ' (तृतीय-पक्ष)'}</a>`).join(', ')
    : 'अधिकृत जाहिरात';

  const verified = lastVerified(p);
  const verifiedHtml = verified ? `<div class="verified-line">✅ माहिती तपासलेली: ${fmtDate(verified)}</div>` : '';
  const st = statusBadge(p);
  const closedNote = closed ? `<div class="closed-note">🔴 या भरतीची अर्ज प्रक्रिया बंद झाली आहे. हे पान ऐतिहासिक संदर्भासाठी उपलब्ध आहे.</div>` : '';

  // Structured source-backed sections — heading आधीच content.sections मध्ये असल्यास duplicate रेंडर नाही
  // (ही heading सूची = LOCKED TEMPLATE क्रम — auto-sections आणि content.sections कधीच एकमेकांचे
  // duplicate दिसणार नाहीत, आणि तुमचा format नेहमी या क्रमात render होतो)
  const LOCKED_SECTION_ORDER = [
    ['महत्त्वाच्या तारखा', datesTable(p)],
    ['ही भरती तुमच्यासाठी आहे का? 👀', checklistHtml(p)],
    ['वेतन / Pay Scale', salaryHtml(p)],
    ['निवड प्रक्रिया', selectionHtml(p)],
    ['अर्ज कसा करायचा?', howToApplyHtml(p, closed)],
    ['कोणती कागदपत्रे लागतील?', documentsHtml(p)]
  ];
  const sectionHeadings = new Set((p.content.sections || []).map(s => safeText(s.heading).replace(/\s+/g, ' ').trim()));
  const structured = LOCKED_SECTION_ORDER
    .filter(([, html]) => html)
    // content.sections मध्ये त्याच नावाचा section असल्यास duplicate टाळा —
    // auto-section ची heading disabled, पण क्रम LOCKED order ने stable राहतो.
    .filter(([h]) => !sectionHeadings.has(h))
    .map(([, html]) => html).join('');

  const body = `
${breadcrumbHtml(cat)}
<div class="page-header"><h1>${esc(p.title)}</h1></div>
<div class="status-row">${st || ''}<span class="last-updated">प्रकाशित: ${esc((p.publishedAt || '').slice(0, 10))} · अखेरचे अद्ययावत: ${esc((p.lastUpdatedAt || '').slice(0, 10))}</span></div>
${verifiedHtml}
${closedNote}
<div class="highlight"><strong>थोडक्यात:</strong> ${esc(safeText(p.content.shortDesc))}</div>
${infoTable(p)}
${sections}
${structured}
${updates}
${linksHtml}
${faqHtml}
${relatedHtml}
<div class="source-row">
  <span>स्रोत: ${sourceHtml}</span>
  <span>⚠ ही माहिती केवळ सर्वसाधारण मार्गदर्शनासाठी आहे. अंतिम व अचूक माहितीसाठी नेहमी अधिकृत जाहिरात तपासा.</span>
</div>`;

  // JSON-LD — guarded: null timestamps कधीच emit नाही (invalid structured data टाळा)
  const schemas = [];
  if (p.publishedAt) {
    schemas.push(`{"@context":"https://schema.org","@type":"Article","headline":${JSON.stringify(p.title)},"datePublished":"${p.publishedAt.slice(0, 10)}","dateModified":"${(p.lastUpdatedAt || p.publishedAt).slice(0, 10)}","author":{"@type":"Organization","name":"MarathiAura"},"mainEntityOfPage":"${site.url}${pathOf(p)}"}`);
  }
  if (p.type === 'recruitment') {
    const job = {
      '@context': 'https://schema.org', '@type': 'JobPosting',
      title: p.title, description: safeText(p.content.shortDesc),
      employmentType: 'OTHER',
      hiringOrganization: { '@type': 'Organization', name: safeText(p.department) || 'Official' },
      jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: 'IN' } },
      url: site.url + pathOf(p)
    };
    if (p.publishedAt) job.datePosted = p.publishedAt.slice(0, 10);
    if (p.dates && p.dates.applicationEnd) job.validThrough = `${p.dates.applicationEnd}T23:59:59+05:30`;
    schemas.push(JSON.stringify(job));
  }
  if (faqs.length) {
    schemas.push(`{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[${faqs.map(f => `{"@type":"Question","name":${JSON.stringify(f.q)},"acceptedAnswer":{"@type":"Answer","text":${JSON.stringify(f.a)}}}`).join(',')}]}`);
  }
  write(pathOf(p).replace(/^\//, '') + 'index.html',
    pageHtml(site, categories, { title: p.title, description: p.content.metaDescription || p.content.shortDesc, canonical: site.url + pathOf(p), body, ogImage: p.seo.ogImage, type: 'article',
      index: p.seo.index !== false }) // seo.index=false → noindex,follow (आणि sitemap मधून वगळलेलेच राहते)
      .replace('</head>', `<script type="application/ld+json">\n${schemas.join('\n')}\n</script>\n</head>`)
  );
  if (p.seo.ogImage) write(p.seo.ogImage.replace(/^\//, ''), svgOg(p.title, catName));
  count++;
  console.log(`  post: ${pathOf(p)}`);
}

for (const p of posts) {
  if (!p.path || !p.content || !p.content.shortDesc) { console.error(`  [SKIP] incomplete record: ${p.id}`); continue; }
  if (p.type === 'syllabus') continue; // dedicated syllabus.mjs generator (type-specific template)
  renderPost(p);
}

// Category index pages — फक्त जेव्हा category मध्ये प्रकाशित content आहे (thin page नियम)
// Active/Useful आधी, बंद/जुन्या नंतर वेगळ्या section मध्ये (Part 4/12)
const splitByStatus = list => ({
  active: list.filter(p => !isClosed(p)),
  closed: list.filter(p => isClosed(p))
});

function closedSection(cards) {
  return cards.length ? `<h2 class="section-title">बंद झालेल्या भरती (ऐतिहासिक संदर्भ)</h2>
<div class="post-list">
${cards.join('\n')}
</div>` : '';
}

for (const cat of categories) {
  if (cat.id === 'latest-bharti') continue; // वेगळ्या नावाने खाली
  if (cat.id === 'syllabus') continue; // dedicated syllabus hub (syllabus.mjs) याला handle करते
  const catPosts = posts.filter(p => p.category === cat.id)
    .sort((a, b) => String(b.lastUpdatedAt || '').localeCompare(String(a.lastUpdatedAt || '')));
  if (!catPosts.length) continue;
  const { active, closed: closedPosts } = splitByStatus(catPosts);
  const activeCards = active.map(p => postCard(p, catById[p.category]));
  const closedCards = closedPosts.map(p => postCard(p, catById[p.category]));
  const body = `
<div class="page-header"><h1>${esc(cat.nameMr)}</h1></div>
<p>${esc(cat.description)}</p>
<!--active-list-->
<div class="post-list">
${activeCards.join('\n') || '<p class="empty-state">सध्या या विभागात अर्ज सुरू असलेली भरती नाही.</p>'}
</div>
<!--/active-list-->
${closedSection(closedCards)}`;
  write(cat.path.replace(/^\//, '') + 'index.html',
    pageHtml(site, categories, { title: `${cat.nameMr} 2026 — ${cat.name}`, description: cat.description, canonical: site.url + cat.path, body }));
  console.log(`  category: ${cat.path} (active ${activeCards.length}, closed ${closedCards.length})`);
}

// /latest-bharti/ — सर्व recruitment updates (active आधी, बंद archive नंतर)
const recPosts = posts.filter(p => p.type === 'recruitment')
  .sort((a, b) => String(b.lastUpdatedAt || '').localeCompare(String(a.lastUpdatedAt || '')));
if (recPosts.length) {
  const { active, closed: closedPosts } = splitByStatus(recPosts);
  const catOf = p => catById[p.category];
  const body = `
<div class="page-header"><h1>नवीन सरकारी भरती 2026</h1></div>
<p>सर्व नवीन सरकारी व महाराष्ट्र भरतींची अपडेट्स — जाहिरात, पात्रता, अर्ज आणि शेवटची तारीख.</p>
<!--active-list-->
<h2 class="section-title">अर्ज सुरू असलेली भरती</h2>
<div class="post-list">
${active.map(p => postCard(p, catOf(p))).join('\n') || '<p class="empty-state">सध्या अर्ज सुरू असलेली भरती नाही — नवीन जाहिरातीसाठी पुन्हा भेट द्या.</p>'}
</div>
<!--/active-list-->
${closedSection(closedPosts.map(p => postCard(p, catOf(p))))}`;
  write('latest-bharti/index.html',
    pageHtml(site, categories, { title: 'नवीन भरती 2026 — Latest Government Jobs', description: 'सर्व नवीन सरकारी भरती 2026 — जाहिरात, पात्रता, अर्ज आणि शेवटची तारीख.', canonical: site.url + '/latest-bharti/', body }));
  console.log(`  category: /latest-bharti/ (active ${active.length}, closed ${closedPosts.length})`);
}

console.log(`posts.mjs: ${count} article pages generated`);

