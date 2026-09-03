# MarathiAura – URL Structure & Sitemap Strategy

## 1. URL Rules

- Short, clean, lowercase, hyphenated — कोणतेही query parameters / file extensions नाहीत
- Marathi + English keyword mix titles असले तरी **URL English राहतील** (shareable, readable)
- एक URL = एकच canonical अर्थ; bharti बदलली तर तोच URL update होईल, नवीन URL नाही
- Renamed/removed pages साठी 301 redirect map ठेवायची

```
✅ /police-bharti-2026/
✅ /mpsc/rajyaseva/
✅ /police-bharti-syllabus/
❌ /p/post?id=123&cat=xyz
❌ /Police_Bharti_2026_Final_Article_v2.html
```

## 2. Top-Level Route Map (Phase 1–2)

| Route | Page type | Phase |
|---|---|---|
| `/` | Homepage (hero, latest recruitment, exam-wise sections, latest updates, current affairs, mock tests, important links) | 1 |
| `/latest-bharti/` | All recruitment index + filters (qualification, department, location, last date) | 1 |
| `/mpsc/` | MPSC category index | 1 |
| `/mpsc/rajyaseva/` | Exam hub — complete ecosystem page | 1 |
| `/police-bharti/` | Category index | 1 |
| `/talathi/`, `/gramsevak/`, `/maharashtra-bharti/` | Category indexes | 1 |
| `/syllabus/<exam>/` | Syllabus pages (e.g. `/syllabus/police-bharti/`) | 1 |
| `/mock-test/` | Test listing | 1 |
| `/mock-test/<test-id>/` | Individual mock test (client-side engine) | 1 |
| `/current-affairs/` | CA index (daily/monthly/oneliner tabs) | 1 |
| `/current-affairs/<yyyy-mm-dd>/` | Daily CA page | 1 |
| `/current-affairs/monthly-<month-yyyy>/` | Monthly CA page | 2 |
| `/answer-key/`, `/result/`, `/admit-card/` | Update indexes (Phase 2 मध्ये पूर्ण) | 2 |
| `/ssc/`, `/railway/`, `/banking/` | Category indexes | 2 |
| `/previous-papers/` | Previous year papers organized exam-wise | 2 |
| `/study-material/` | Notes index (Maths, Reasoning, Marathi Grammar, GK…) | 2 |
| `/maharashtra-gk/` | Maharashtra GK hub (history, geography, districts, forts…) | 2 |
| `/yojna/` | Government schemes | 2 |
| `/about/`, `/contact/`, `/privacy-policy/`, `/terms/`, `/disclaimer/`, `/editorial-policy/` | Trust pages | 1 |
| `/search` | Site search (client-side index) | 1 |
| `/404.html` | Custom 404 | 1 |

Recruitment article URLs: top-level short URLs (`/police-bharti-2026/`) — category मध्ये internally linked, पण URL मध्ये category prefix नाही (short URLs #37).

## 3. Programmatic SEO Pages — कधी बनवायच्या

| Pattern | उदाहरण | अट |
|---|---|---|
| `/bharti/<exam>/<state>/` | `/bharti/police/maharashtra/` | फक्त जेव्हा खरी, वेगळी content असेल |
| `/result/<exam>/` | `/result/police-bharti/` | result जाहीर झाल्यावरच |
| `/syllabus/<exam>/` | `/syllabus/talathi/` | syllabus data पूर्ण असेल तरच |

> **Thin page नियम:** template भरून काढण्यासाठी page तयार करू नये. Unique value (real vacancies, real dates, real syllabus topics) नसेल तर ती page generate होणारच नाही — noindex पण नको, तयारच होऊ द्यायची नाही (#39, #31).

## 4. Sitemap Strategy

**Sitemap index + category-wise sitemaps** (मोठ्या scale वर manage करणे सोपे — #40):

```
/sitemap.xml                ← sitemap index
/sitemap-posts.xml          ← सर्व recruitment/update articles
/sitemap-exams.xml          ← exam hub pages
/sitemap-syllabus.xml
/sitemap-mocktests.xml
/sitemap-current-affairs.xml
/sitemap-static.xml         ← homepage, trust pages, search, 404
```

- `sitemap.xml` (index) नेहमी latest सर्व child sitemaps दाखवेल
- प्रत्येक URL ला अचूक `<lastmod>` — record च्या `lastUpdatedAt` वरून
- Generator build च्या वेळी स्वयंचलित update (sitemap.mjs)
- Publish झाल्यावर IndexNow / Google ping (जरी Google मुख्यतः sitemap नेहमीच वाचते)

### robots.txt

```
User-agent: *
Allow: /
Disallow: /assets/js/mock-engine/   (आवश्यक असल्यास)

Sitemap: https://marathiaura.in/sitemap.xml
```

**महत्त्वाचे:** robots.txt मध्ये `ads.txt` कधीच block होणार नाही — AdSense crawler (Mediapartners-Google / AdsBot) साठी `Allow: /` पूर्ण open ठेवायचे.

## 5. Canonical & Indexing Policy

| Page type | canonical | index? |
|---|---|---|
| Recruitment article | स्वतःचा URL | ✅ (फक्त status=published + genuine content) |
| Exam hub | स्वतःचा URL | ✅ |
| Category index (filters सह) | base URL (filters = query params, canonical base ला) | ✅ base only |
| Search results page | `/search` | ❌ `noindex, follow` |
| Draft/under-review | — | render होणारच नाही |
| Duplicate detection झालेला source variant | canonical main article कडे | redirect/merge |

- Schema markup: Article + JobPosting (recruitment), FAQPage (FAQs — Google guidelines नुसार), BreadcrumbList, WebSite (SearchAction)
- Open Graph + Twitter cards सर्व pages वर

## 6. Internal Linking Model

प्रत्येक recruitment article वर automatic "संबंधित माहिती" block:

```
भरती लेख →  • Syllabus page  • Mock Tests  • Previous Papers
            • Admit Card  • Answer Key  • Result
```

Exam hub → category च्या सर्व latest articles + syllabus + tests. Category index → exam hubs. हे cross-linking network search engines आणि user journey दोन्हीसाठी (#22, #45).

## 7. Redirect & Migration Management

- `data/redirects.json` — `[{ "from": "/old-url/", "to": "/new-url/" }]`
- GitHub Pages कडे native redirects नसल्यामुळे: meta-refresh/JS fallback stub pages generate करायचे किंवा Cloudflare page rules वापरायचे
- जुन्या marathiaura URLs (जर indexed असतील) नवीन structure कडे map करण्यासाठी याच file चा वापर

## 8. AdSense / Monetization Placement (Architecture Note)

- AdSense publisher ID फक्त `data/site.json` मध्ये; templates generator तिथून inject करतील (head auto-ads script सर्व pages वर)
- `ads.txt` repo root मध्ये generate होईल — `google.com, pub-…, DIRECT, f08c47fec0942fa0`
- Ad units: content-first — वर/खाली natural breaks वर, UX खराब करणारे placements नाहीत (#26); traffic+quality आधी, optimization नंतर

## 9. Analytics & Search Console (Setup Checklist)

- [ ] Google Search Console — domain property, sitemap submit
- [ ] Analytics (GA4 किंवा privacy-friendly पर्याय) — lightweight, async load
- [ ] Bing Webmaster (मोफत, Bing/ChatGPT traffic साठी)
- [ ] Custom domain HTTPS verify

