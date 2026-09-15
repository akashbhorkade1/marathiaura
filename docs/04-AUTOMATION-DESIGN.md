# MarathiAura – Automation Design (Confidence, Hash, Source Verification)

## 1. Confidence Policy (frozen)

`confidence` = एका record मधील माहिती किती पडताळणी-योग्य आहे याचा numeric score (0–100). हे arbitrary नाही — खालील factor table वरून calculate होते:

### Factor Score Table

| Factor | Points |
|---|---|
| Official source (priority 1) उपलब्ध + link verified HTTP 200 | +30 |
| Government portal source (priority 2) | +20 |
| Secondary source (priority 3) फक्त | +10 |
| Priority 4 फक्त / स्रोत नाही | +0 |
| आवश्यक structured fields भरले आहेत (dates, links, mode) | +20 |
| Fields partially भरले | +10 |
| स्रोतात नसलेले fields `null` ठेवले (guess केले नाही) | +20 |
| Content hash आधीच्या version शी match (no drift) | +15 |
| AI-generated section, human-reviewed | +15 |
| AI-generated, unreviewed | +0 |

Max = 100. Score ≥ 100 नसेल तर cap करावा. Score calculate करणारे एकमेव code: `automation/validate.mjs`.

### Tiers (action mapping)

| Range | Action |
|---|---|
| 95–100 | **Auto Publish** — फक्त highly structured facts (dates, links, availability) |
| 85–94 | **Review Recommended** — review queue; human approve केल्यावरच publish |
| 70–84 | **Manual Review** — review queue + priority flag; publish होण्यासाठी human edit आवश्यक |
| < 70 | **Reject / Hold** — generator कधीच render करत नाही |

### Status ↔ Confidence enforcement (validate.mjs)

- `confidence < 85` आणि `status = published` → status force-downgrade `under-review` + warning (publish होणार नाही)
- `confidence < 70` कोणताही status → flag
- Human approval = status `published`/`verified` करणे **आणि** confidence ≥ 85 दोन्ही आवश्यक

## 2. contentHash Algorithm (frozen)

**SHA-256**, hex, खालील stable-JSON वर:

```
payload = { title, content, recruitment, dates, links }   // फक्त वरील क्रमाने
contentHash = sha256(JSON.stringify(payload))             // no spaces (compact)
```

- `updates[]`, `sources[]`, timestamps hash मध्ये **नाहीत** (त्यांमुळे स्वतः बदलतात)
- Key order stable → `JSON.stringify` object insertion order वापरते, म्हणून payload manually वरील क्रमाने build करावा
- वापर: same article पुन्हा आला? / content बदलले? / AI ने unnecessary rewrite केला? — detect करण्यासाठी
- `validate.mjs` दर धावेळी recompute करून stored `contentHash` शी compare करते; mismatch असल्यास `lastUpdatedAt` bump करणे automation चे काम

## 3. Feed / Source Verification Policy

1. नवीन feed `data/site.json` मध्ये जोडताना **`verified: false`** ठेवावे
2. Manual verification: URL fetch → content-type XML/RSS? → items parse होतात? → titles योग्य? → `verified: true` करावे
3. `verified: false` feeds monitor **कधीच fetch करत नाही** (log मध्ये warning)
4. Verified feed लागोपाठ 5 धावा fail झाल्यास monitor त्याला `verified: false` करू शकतो (future enhancement)
5. HTML-diff sources (RSS नसलेले official pages) — `type: "html"`, `anchorPattern` config सह — **implemented**; तसेच `type: "article-list"` (WordPress-सारख्या sites वरून article title + summary extract, source credit अनिवार्य). Secondary (बिगर-अधिकृत) sources = priority 3 — त्यांचे drafts नेहमी review-queue ला जातात, auto-publish कधीच नाही.

## 4. Review Workflow

```
monitor → draft (status: ai-generated, confidence: computed)
        → review-queue.json entry
        → HUMAN: record तपासा → fields भरा/दुरुस्त करा
        → status: published + confidence ≥ 85
        → पुढील build मध्ये site वर
```

Human approval चे साधन: `automation/review.mjs` CLI:

```
node automation/review.mjs                → review-queue list (id, confidence, वय)
node automation/review.mjs approve <id>  → status: published (confidence ≥ 85 आवश्यक) + data/posts/<id>.json अपडेट
node automation/review.mjs reject <id>   → status: archived — generator कधीच render करणार नाही
```

Approve नंतर `node automation/build.mjs` चालवावेच (त्यानंतरच site वर render होते). Review queue entries जुन्या झाल्या की (14 दिवस) त्यांना `archived` flag — stale drafts कधीच live जाऊ नये.

## 5. Update Detection (change pipeline)

प्रत्येक monitor धावेळी:
1. Feed item → normalized title + link शी existing records शी match (शक्य असल्यास official URL match)
2. Match मिळाला आणि source content बदलला → record च्या `updates[]` मध्ये entry + `lastUpdatedAt` bump + hash recompute
3. Match नाही → नवीन draft
4. कधीच: नवीन record तयार करून duplicate/thin content वाढवू नये

## 6. AI Rewrite Policy (rewrite.mjs)

- Review-queue मधील `rewritePending: true` drafts फक्त AI द्वारे **Marathi** मध्ये rewrite होतात (OpenAI-compatible endpoint — Gemini free tier default).
- **Frozen नियम:** AI कधीच facts invent करू शकत नाही — dates, संख्या, पदे, शुल्क, URLs source प्रमाणेच; अनिश्चित माहिती वगळावी.
- Env config: `AI_API_KEY` (secret), `AI_BASE_URL`, `AI_MODEL`. Key नसेल तर step safe skip — pipeline कधीच block नाही.
- Limits: प्रति धाव max 10 rewrites (free tier rate limits). API fail = template fallback.
- Rewrite झाल्यावर `aiRewritten: true` — पण **confidence bump नाही** (docs/04 §1: AI unreviewed = +0). Status `ai-generated` तसेच — publish फक्त human approval (`review.mjs approve`) नंतरच.
- API key कधीच repo/commit मध्ये नाही — फक्त GitHub Secrets.

## 7. Recruitment Status + Output Gate (frozen)

### 7.1 Status derivation (lib.mjs `recruitStatus`)

Status **कधीच manually type करायचा नाही** — dates वरून machine-derived (Part 3/4). Priority order:

1. `dates.resultDate` उलटली → `RESULT`
2. `dates.applicationEnd` उलटली → `ADMIT_CARD` (admitCardDate आली असेल तर) नाहीतर `CLOSED`
3. `dates.applicationStart` भविष्यात → `UPCOMING`
4. `applicationEnd` ≤ `CLOSING_SOON_DAYS` (7) दिवस बाकी → `CLOSING_SOON`
5. अन्यथा → `ACTIVE`

`CLOSING_SOON` = 7 दिवस — एकच constant (`CLOSING_SOON_DAYS`), इतर कोणतीही जागा हा नियम duplicate करत नाही.

### 7.2 Expired content कधीच active दिसू नये

- `isClosed(p)` = `CLOSED | ADMIT_CARD | RESULT` — या records फक्त "बंद झालेल्या भरती (ऐतिहासिक संदर्भ)" section मध्ये (Part 4/12).
- Homepage/hub वरील active sections `<!--active-list--> … <!--/active-list-->` markers ने wrap केलेले आहेत; validate-output.mjs याच markers मध्ये expired path आढळल्यास build FAIL करते.
- Expired page हटवायचे नाही, redirect करायचे नाही — page ऐतिहासिक संदर्भासाठी 200 + `अर्ज बंद` badge सह राहते; Apply लिंक "अर्ज बंद — संदर्भासाठी" होते.

### 7.3 Safe text extraction (Part 8)

Source content साठी **नेहमी** `safeText()` (lib.mjs) वापरा — implicit object→string कधीच नाही:

| Source value | Result |
|---|---|
| `string` / finite `number` | trimmed text |
| XML node (`_`, `#text`, `textContent`, `text`, `value`, `label`, `title`, `href`, `url`) | त्या field मधील text |
| unknown object (उदा. DOM node) | `''` (कधीच `[object Object]` / `System.Xml.XmlElement` नाही) |
| `array` | प्रत्येक item चे safeText, `, ` ने joined |
| `null` / `undefined` / `NaN` / `Infinity` | `''` |

### 7.4 Build output gate (validate-output.mjs — build.mjs चा शेवटचा step)

`node automation/build.mjs` खालीलपैकी काहीही आढळल्यास **exit 1** — deploy कधीच होत नाही:

1. Serialization leaks: `System.Xml`, `XmlElement`, `[object Object]`, visible `undefined` / `NaN`
2. Expired recruitment active section मध्ये
3. Recruitment page वर status badge नाही
4. noindex page sitemap मध्ये
5. Invalid sitemap entry (missing file, duplicate URL, non-https)
6. Internal link 404 (orphans/unresolved paths)
7. Indexability invariants: important page accidentally noindex; indexable page sitemap मधून गायब

Locally: `node automation/validate-output.mjs` (build नंतर). CI: deploy.yml मध्ये `build.mjs` मध्येच समाविष्ट असल्याने वेगळा step आवश्यक नाही.

### 7.5 Tests

- `node automation/test/test-core.test.cjs` — core/mock-test engine
- `node automation/test/render.test.cjs` — status derivation, safeText (XML/array/null), badges, link trust, breadcrumb, escaping

दोन्ही suites deploy.yml मध्ये build आधी चालतात.
