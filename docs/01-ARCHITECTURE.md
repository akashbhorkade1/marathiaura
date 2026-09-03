# MarathiAura – System Architecture

## 1. Stack Decision (Phase 1)

| Layer | Choice | कारण |
|---|---|---|
| Site generation | **Static generation** (Node.js generators किंवा PowerShell — build step वेगळा, templates reusable) | मोफत hosting, CDN speed, कमीत कमी attack surface, Core Web Vitals friendly |
| "Database" | **Structured JSON files** (`data/` folder) — future-ready schema | Version control मध्येच audit trail; Phase 3 मध्ये तोच schema DB मध्ये migrate होईल |
| Automation | **GitHub Actions** (scheduled cron) | Server नाही, free, logs public — रेपो मध्येच monitoring |
| Hosting | **GitHub Pages** + custom domain (marathiaura.in) + Cloudflare (optional) | Free CDN, HTTPS, caching |
| Mock tests | **Client-side JS engine** reading JSON question bank | Server काही लागत नाही; Phase 3 मध्ये backend accounts analytics साठी add होऊ शकतात |

**हा stack कधी बदलणार नाही असे नाही** — data schema future-proof आहे, त्यामुळे static → dynamic migration वेळेवर frontend बदलून होईल, data दुसरीकडे नेता येईल.

## 2. High-Level Automation Flow

```
Official Sources (Level 1-4, पहा §6)
        │
        ▼
┌─────────────────┐
│ Source Monitor  │  RSS / sitemap diff / page hash — प्रत्येक source साठी modular job
└─────────────────┘
        │  "new / changed" signal
        ▼
┌─────────────────┐
│ Change Detection│  duplicate detection (canonical URL, title-normalize, content-hash)
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ Data Extraction │  structured fields (vacancies, dates, fee, links) — template-मध्ये भरण्यायोग्य
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ Validation      │  date / URL / vacancy sanity, missing-fields check, contradictions
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ AI Processing   │  summarization, Marathi formatting, meta/FAQ — facts invent करू नयेत
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ Confidence Check│  ≥95% auto-publish · 80–95% review queue · <80% manual only
└─────────────────┘
        │
        ├──→ review-queue.json (human approval, status flip करून)
        ▼
┌─────────────────┐
│ Data Layer      │  data/posts/…, data/exams/… (single canonical record per bharti)
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ Static Generator│  HTML pages + sitemap + RSS + OG images
└─────────────────┘
        │
        ▼
   GitHub Pages (site) → Search Engine ping → Analytics
```

**Failure isolation नियम:** प्रत्येक stage modular आहे. एक source/scraper fail झाला तरी बाकीचे sources आणि site build चालू राहिले पाहिजेत. Generator नेहमी "last good" data वापरून build करेल; automation fail झाल्यास site कधीच डाउन होणार नाही (static असल्यामुळे site तरी चालूच राहते).

## 3. Repository Structure (Planned)

```
/
├── docs/                      ← हे design documents
├── data/                      ← "database"
│   ├── site.json              ← site config (url, adsense pub id, social links)
│   ├── categories.json        ← category definitions
│   ├── posts/                 ← प्रत्येक bharti/article = 1 JSON record (canonical model)
│   ├── exams/                 ← exam hub records (MPSC Rajyaseva, Police Bharti…)
│   ├── questions/             ← mock test question bank (exam-wise files)
│   └── review-queue.json      ← confidence 80–95% records awaiting human approval
├── automation/                ← modular scripts (एक stage = एक script)
│   ├── sources/               ← per-source monitors (MPSC, SSC, …)
│   ├── extract.ps1/.mjs
│   ├── validate.ps1/.mjs
│   └── generate/
│       ├── posts.mjs          ← article pages
│       ├── exam-hubs.mjs
│       ├── homepage.mjs
│       ├── mock-test.mjs      ← test pages + engine bundle
│       └── sitemap.mjs
├── templates/                 ← reusable HTML partials (head, nav, footer, post-card…)
├── assets/                    ← css, js (mock engine), favicon, logo
├── .github/workflows/         ← scheduled automation + deploy
├── ads.txt
├── robots.txt
└── 404.html
```

**Output folders** (generated, git मध्ये commit होतात जेणेकरून Pages ला deploy सोपे होईल): category folders (`/mpsc/`, `/police-bharti/` …), post pages, `/mock-test/`, `/current-affairs/` इत्यादी.

## 4. Page Types (Templates)

1. **Recruitment / Update article** — standardized structure (भरतीचे नाव, विभाग, जागा, पात्रता, वय, फी, तारखा, निवड प्रक्रिया, official links, FAQs, source banner, Published/Last Updated). Sections render from data fields — hardcoded paragraphs नाहीत.
2. **Exam Hub** (`/mpsc/rajyaseva` style) — exam चा complete ecosystem page: eligibility, pattern, syllabus, papers, mock tests, results — सर्व internal links.
3. **Category index** — filters (#44): department, qualification (10वी/12वी/Graduate), location, last date.
4. **Syllabus page** — subject-wise → topic-wise, marks, questions, duration, negative marking.
5. **Mock Test page** — timer, MCQ navigation, submit, score + accuracy + solutions (client-side).
6. **Current Affairs** — daily / monthly / one-liner (प्रश्न→उत्तर format).
7. **Static trust pages** — About, Contact, Privacy, Terms, Disclaimer, Editorial Policy (#27).

## 5. Content Quality / Confidence System

प्रत्येक record ला `status` + `confidence` fields (पहा 02-DATA-SCHEMA.md):

| Confidence | वर्तन |
|---|---|
| ≥ 95% | Auto-publish (फक्त highly structured facts: dates, links, availability) |
| 80–95% | `review-queue.json` मध्ये — human approval नंतरच publish |
| < 80% | Generator त्या record ला render करणारच नाही |

Semi-automated content (recruitment articles, syllabus, current affairs) नेहमी validation layer मधून जाईल. Fake recruitment / guessed vacancy numbers / fake deadlines = hard reject.

## 6. Source Priority System

| Level | Type | वापर |
|---|---|---|
| 1 | Official notification / portal (MPSC.gov.in, जाहिरात PDF) | Primary — final fact |
| 2 | Government portal (maharashtra.gov.in उप-संकेतस्थळे) | Trusted |
| 3 | Reputed news / education portal | Secondary verification |
| 4 | Other websites / social media | फक्त discovery, कधीच final fact नाही |

Conflict झाल्यास: **Official > Government > trusted secondary > other**. प्रत्येक article वर "स्रोत: अधिकृत जाहिरात / Official Website" दाखवायचे.

## 7. Duplicate Protection (Canonical Model)

एकाच bharti बद्दल नवीन/जुन्या माहिती आल्यास **नवीन article तयार होणार नाही**. विद्यमान canonical record च्या `updates[]` array मध्ये timestamped update add होईल आणि article पेजवर "अपडेट्स" section render होईल. Detection keys: normalized title, official notification URL, apply URL, content hash.

## 8. SEO & Freshness

- Templates मध्ये: canonical, OG, JSON-LD (Article/JobPosting/FAQ/Breadcrumb — Google च्या current guidelines नुसार), breadcrumbs, internal links (संबंधित syllabus / mock test / answer key / result).
- `published` + `lastUpdated` timestamps प्रत्येक article वर.
- Thin pages generator मधूनच exclude (noindex नाही — तयारच होणार नाहीत).
- Fresh updates feed homepage वर (breaking update strip).

## 9. Speed / Mobile

- कमीत कमी JS; mock engine फक्त त्या page वर load होईल (lazy)
- System fonts / lightweight CSS, no framework
- Images: lazy loading, `width/height` सह (CLS prevention), SVG OG images (auto-generated)
- Mobile: मोठे fonts, sticky nav, simple tables, collapsible sections, लांब पोस्टवर reading progress

## 10. Security Notes

- Static site = कमीत कमी attack surface; user input फक्त site search (client-side) वर — तिथे output escaping आवश्यक
- Automation मध्ये external content कधीच raw HTML म्हणून inject करू नये — नेहमी sanitize/strip करून text-only render
- `.env` / API keys GitHub secrets मध्ये, रेपो मध्ये कधीच नाहीत
- Comments / user-generated content टाळून spam+moderation overhead टाळता येते (Telegram/WhatsApp वर community)

