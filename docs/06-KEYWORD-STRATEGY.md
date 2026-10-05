# MarathiAura — Page-Level Keyword Strategy (SEO)

> **उद्देश:** प्रत्येक महत्त्वाच्या पानाला **एक स्पष्ट primary search intent** देणे — keyword stuffing
> किंवा छुपवलेल्या keywords शिवाय. हा document implementation-पूर्वीचा mapping report आहे
> आणि नंतरच्या नवीन posts/hubs साठीचा reference देखील.

---

## 1. Audit — सध्याचे SEO schema आणि rendering flow

| घटक | कुठे generate होतो | स्रोत |
|---|---|---|
| `<title>` (article/syllabus) | `posts.mjs` / `syllabus.mjs` | `p.title` (data) |
| `<title>` (category hub) | `posts.mjs` | `${cat.nameMr} 2026 — ${cat.name}` template |
| `<title>` (homepage/hubs) | `homepage.mjs`, `mock-test.mjs`, `syllabus.mjs` | generator hard-code |
| Meta description (article) | `posts.mjs` | `content.metaDescription \|\| content.shortDesc` |
| Meta description (category) | `posts.mjs` | `cat.description` (तोच व्हिजिबल intro म्हणूनही) |
| H1 | article=`p.title` · category=`cat.nameMr` · hubs=hard-code | data/generator |
| canonical / robots / OG / sitemap / RSS | `lib.mjs headHtml()` · `sitemap.mjs` | working — यात बदल नाही |
| Structured data | `posts.mjs` (Article + JobPosting + FAQPage) | फक्त article pages वर |
| Breadcrumbs | `lib.mjs breadcrumbHtml()` (dead-link guard) | category link फक्त generated hub-साठी |

### अस्तित्वात असलेले SEO keyword fields (नवीन field लागला नाही)

- **`seo.keywords[]`** — Schema V2 (`docs/02 §1`) मध्ये आधीच असून **सर्व 19 published posts वर भरलेले आहे.**
  हे field **डेटा-स्तरावरचा editorial keyword registry** आहे: ते कधीच `<meta name="keywords">`
  म्हणून render होत नाही (आणि होणारच नाही — spam rule). नवीन post करताना याच फॉर्मॅटमध्येच primary + secondary
  keywords नोंदवावेत.
- **`content.metaDescription`** — render होत आहे (सर्व published posts वर सेट आहे).
- **`seo.ogImage` / `seo.index`** — OG image व noindex logic सुरू आहे; त्यात बदल नाही.

**नवीन schema field जोडला नाही · `<meta name="keywords">` जोडला नाही · URL/canonical/robots/sitemap
logic बदलला नाही.**

---

## 2. Page-level keyword mapping (existing pages only)

| Page | Page Type | Primary Keyword | Secondary Keywords | Search Intent |
|------|-----------|------------------|--------------------|---------------|
| `/` | Homepage | महाराष्ट्र सरकारी भरती | महाराष्ट्र सरकारी नोकरी, नवीन सरकारी भरती, सरकारी नोकरी अपडेट, स्पर्धा परीक्षा मराठी, मराठी ऑनलाइन टेस्ट, MarathiAura | Brand + mixed (navigational/informational) |
| `/latest-bharti/` | Recruitment hub | महाराष्ट्र सरकारी नोकरी | नवीन सरकारी भरती, सरकारी भरती जाहिरात, Latest Bharti, भरती शेवटची तारीख | Informational / transactional |
| `/police-bharti/` | Category hub | महाराष्ट्र पोलीस भरती | पोलीस भरती, Police Bharti, शारीरिक चाचणी, पोलीस भरती अभ्यासक्रम | Informational |
| `/talathi/` | Category hub | तलाठी भरती | तलाठी भरती 2026, महसूल विभाग भरती, Talathi Bharti | Informational |
| `/ssc/` | Category hub | SSC भरती | SSC परीक्षा, SSC CHSL/JE/CAPF भरती, 12वी पास सरकारी नोकरी | Informational |
| `/railway/` | Category hub | रेल्वे भरती | RRB भरती, रेल्वे भरती 2026, Konkan Railway भरती | Informational |
| `/banking/` | Category hub | बँक भरती | बँकिंग परीक्षा, IBPS भरती, Bank भरती 2026 | Informational |
| `/result/` | Category hub | भरती निकाल | परीक्षा निकाल, Result, merit list, cut off | Informational |
| `/syllabus/` | Syllabus hub | स्पर्धा परीक्षा अभ्यासक्रम | Syllabus, subject-wise अभ्यासक्रम, exam pattern | Informational |
| `/mock-test/` | Mock-test hub | स्पर्धा परीक्षा Mock Test | मराठी ऑनलाइन टेस्ट, फ्री मॉक टेस्ट, Online Mock Test Marathi | Transactional (free tool) |
| `/mpsc/rajyaseva/` | Exam hub | MPSC राज्यसेवा संयुक्त परीक्षा | पात्रता, वयोमर्यादा, syllabus, exam pattern | Informational |
| `/police-bharti/exam/` | Exam hub | महाराष्ट्र पोलीस भरती | पोलीस भरती पात्रता, पोलीस भरती अभ्यासक्रम, निवड प्रक्रिया | Informational |
| `/syllabus/<exam>/` (3) | Syllabus article | `<exam> Syllabus 2026` (data `title`) | subject-wise topics, exam pattern, तयारीचे टिप्स | Informational |
| `/mock-test/<id>/` (3) | Mock test | test title मधील terms (उदा. पोलीस भरती मॉक टेस्ट) | गणित, बुद्धिमत्ता चाचणी, महाराष्ट्र सामान्य ज्ञान | Transactional |
| `/<recruitment-slug>/` (15) | Recruitment article | **actual recruitment name + 2026** (उदा. महाराष्ट्र पोलीस भरती 2026) | post `seo.keywords[]` मधील secondary terms — पात्रता, वयोमर्यादा, अर्ज, अभ्यासक्रम, निवड प्रक्रिया, शेवटची तारीख | Informational / transactional |
| `/ugc-net-result-june-2026/` | Result article | UGC NET निकाल जून 2026 | scorecard, cut off, गुणवत्ता यादी, Result | Informational |
| `/about/` etc. (trust pages) | Static | MarathiAura (brand, navigational) | — | Navigational |
| `/search.html`, `/404.html` | Utility | — (noindex) | — | — |

### जाणून वगळलेली keywords (content नाही म्हणून)

`चालू घडामोडी मराठी` · `अधिकृत उत्तरतालिका` · `प्रवेशपत्र` · `सरकारी योजना` · `जिल्हा परिषद भरती` ·
`सरळसेवा भरती` · `ग्रामसेवक भरती` · `अंगणवाडी/महावितरण भरती` — या श्रेणींमध्या सध्या **published meaningful content
नाही**, म्हणून हब पेजही generate होत नाहीत आणि त्या keywords कुठेही लक्ष्यित केल्या नाहीत.
Content आल्यावरच (thin-page rule, `docs/03 §3`).

---

## 3. SEO element placement — प्रत्येक page-साठी नियम

- **Title** — primary keyword पुढे, शक्य असताना H1 शी aligned; brand homepage वर.
  वर्ष "2026" फक्त तेव्हाच जेव्हा page खरोखर 2026 च्या भरती/परीक्षेबद्दल आहे (सध्या सर्व hubs वर सुरू आहे —
  पुढील वर्षी refresh करावा).
- **Meta description** — primary topic + search intent एका वाक्यात; स्रोतात नसलेली promise नाही.
- **H1** — पानाचा खरा विषय स्पष्ट; keyword stuffing नाही.
- **Introduction (हायलाइट/पहिले वाक्य)** — विषय स्वाभाविकपणे सांगावा.
- **H2/H3** — फक्त तीच विषय-केंद्रित headings जी data मध्ये खरोखर आहेत
  (`शैक्षणिक पात्रता`, `वयोमर्यादा`, `अर्ज शुल्क व पद्धत`, `निवड प्रक्रिया`, `परीक्षेचे स्वरूप आणि अभ्यासक्रम`…).
- **Internal links** — descriptive anchors (उदा. `Talathi Bharti Syllabus 2026`,
  `पोलीस भरती मॉक टेस्ट 01 — महाराष्ट्र सामान्य ज्ञान`); तोंडी anchors (`अभ्यासक्रम`, `मॉक टेस्ट`) आता
  फक्त fallback म्हणून. Over-optimised anchors नाहीत.
- **Image ALT** — छवीचे वर्णन; keyword list नाही.

## 4. हरे (Do NOT)

1. `<meta name="keywords">` · छुपवलेल्या keywords · footer-मधील keyword dump — **कधीच नाही.**
2. एकाच keyword चा अनावश्यक पुनरावृत्ती (keyword stuffing).
3. असंबंधित pages वर keywords नाहीत.
4. URL/slug, canonical, robots, sitemap, structured-data logic विना कारण बदल नाही.
5. स्रोतात नसलेली तारखा/रिकाम्या जागा/वेतन invent नाही.
6. केवळ search-साठी बनवलेली generic paragraphs नाहीत — content people-first.
7. नवीन schema fields नाहीत — `seo.keywords` आणि `content.metaDescription` हेच वापरायचे.

## 5. नवीन recruitment article कसा तयार करावा (keyword checklist)

1. `title` = `<Recruitment Name> <Year>: <प्रमुख माहिती>` (actual recruitment नावानुसार).
2. `content.metaDescription` = primary + intent (पात्रता/तारीख/अर्ज) एका वाक्यात.
3. `seo.keywords` = primary (recruitment नाव + वर्ष) + 5–10 relevant secondary terms
   (पात्रता, वयोमर्यादा, अर्ज, अर्ज फी, अभ्यासक्रम, निवड प्रक्रिया, शेवटची तारीख, Apply Online) —
   फक्त ते जे पानावर खरोखर आहेत.
4. Sections = data-आधारित; auto-injected headings (`शैक्षणिक पात्रता`, `वयोमर्यादा`, `निवड प्रक्रिया`,
   `अर्ज शुल्क व पद्धत`) फक्त तेव्हाच दिसतील जेव्हा facts असतील.
5. `syllabusRef` / `relatedMockTests` असतील तरच संबंधित internal links आपोआप येतील.

## 6. Implementation notes (या round मध्ये काय बदलले)

| पान | बदल (existing fields/generators only) |
|---|---|
| Homepage | title → `महाराष्ट्र सरकारी भरती 2026, सरकारी नोकरी अपडेट \| MarathiAura`; H1 → primary keyword-सह; `site.description` → primary+secondary स्वाभाविकपणे |
| `/latest-bharti/` | title/intro/meta description मध्ये `महाराष्ट्र सरकारी नोकरी` |
| `/ssc/`, `/banking/`, `/result/` | `nameMr` → `SSC भरती` / `बँक भरती` / `भरती निकाल` (H1, title, breadcrumb, nav एकत्रित) + descriptions |
| Category title template | गरज नसलेला redundant suffix काढला (`SSC भरती 2026 — SSC` → `SSC भरती 2026`) |
| `/syllabus/`, `/mock-test/` | hub title/description/intro = mapped primary keywords |
| Articles | `संबंधित माहिती` anchors = खरे syllabus/mock titles (descriptive) |

> पुढील वर्षी "2026" असलेले titles/`description`s refresh करावेत.

