# MarathiAura – Data Schema V2 (DEFINITIVE — frozen before coding)

> ही **schema lock** आहे. बदल लागल्यास version bump (V3) करावे लागेल. सर्व records आणि generators याच schema नुसार चालतात.

## 1. Common Base Schema (सर्व post-type records साठी MANDATORY)

प्रत्येक `data/posts/*.json` record मध्ये हे base fields **नेहमी** असतील, कोणत्याही type चा असला तरी:

```jsonc
{
  "id": "string — unique, slug-safe, immutable",
  "type": "recruitment | current-affairs | syllabus | study-material | answer-key | result | admit-card | yojna | page",
  "title": "string — display title",
  "slug": "string — URL segment, slashes नाहीत, उदा. 'police-bharti-2026'",
  "path": "string — full URL path, उदा. '/police-bharti-2026/'",
  "category": "string — data/categories.json मधला id",
  "status": "draft | ai-generated | under-review | verified | published | updated | archived",
  "confidence": "number 0–100 (policy: docs/04-AUTOMATION-DESIGN.md)",
  "fixture": "boolean — true असल्यास schema-test sample; production ला launch पूर्वी remove",
  "publishedAt": "ISO 8601 | null",
  "lastUpdatedAt": "ISO 8601 (required)",
  "contentHash": "SHA-256 hex | null (algorithm: docs/04-AUTOMATION-DESIGN.md)",
  "updates": [Update],          // पहा §6
  "sources": [Source],          // पहा §5
  "content": {                  // सर्व types साठी common content block
    "shortDesc": "string 100–300 chars",
    "metaDescription": "string | null",
    "sections": [Section],
    "faqs": [{ "q": "…", "a": "…" }]
  },
  "seo": {
    "keywords": ["…"],
    "ogImage": "/og-images/…svg | null",
    "index": true
  }
}
```

**Generator नियम:** फक्त `status ∈ {published, updated}` render होते. `fixture: true` records build मध्ये render होऊ शकतात पण launch checklist मध्ये शोधून काढायचे.

### Section (content.sections[])

```jsonc
{ "heading": "string", "type": "text | table | list | olist",
  "body": "text साठी", "headers": [], "rows": [[]], "items": [] }
```

## 2. Recruitment Schema (base + खालील fields)

```jsonc
{
  "exam": "exam id | null",
  "department": "string",
  "recruitment": {
    "postNames": ["…"],
    "vacancies": "number | null — guess कधीच नाही",
    "vacanciesNote": "string | null",
    "qualification": ["…"],
    "ageLimit": { "min": n, "max": n, "relaxation": "string | null" } | null,
    "salary": { "payScale": "…", "note": null } | null,
    "fee": { "general": n|null, "reserved": n|null, "note": null } | null,
    "applicationMode": "Online | Offline | null",
    "location": "string",
    "jobType": "government | semi-government | private"
  },
  "dates": {
    "notification": "YYYY-MM-DD | null", "applicationStart": "…", "applicationEnd": "…",
    "examDate": "…", "admitCardDate": "…", "resultDate": "…"
  },
  "links": { "notificationUrl": null, "applyUrl": null, "officialUrl": null },
  "selectionProcess": ["…"],
  "syllabusRef": "path | null — फक्त ते page अस्तित्वात असतानाच",
  "relatedMockTests": ["testId"]
}
```

> `links` = UI दाखवण्यासाठी primary URLs. `sources[]` = provenance/automation tracking. दोन्ही वेगळे राहतील.

## 2b. Syllabus Schema (base + खालील fields) — type: "syllabus"

```jsonc
{
  "exam": "exam id — संबंधित data/exams record",
  "syllabus": {
    "examPattern": {
      "stages": ["…"],
      "papers": [{ "name": "…", "questions": n|null, "marks": n|null, "duration": "…|null", "negativeMarking": "…|null" }]
    },
    "subjects": [
      { "subject": "मराठी",
        "topics": [ { "topic": "व्याकरण", "points": ["…", "…"] } ]   // topic-level granularity — future Question Bank mapping
      }
    ],
    "preparationTips": ["…"],
    "officialSyllabusUrl": "URL | null — अधिकृत PDF असेल तरच",
    "note": "अधिकृत अभ्यासक्रम disclaimer"
  },
  "syllabusRef": "base मध्ये नाही — हे recruitment/exam records वरचे field असते जे syllabus page path कडे point करते",
  "relatedMockTests": ["testId"]
}
```

**नियम:**
- `syllabusRef` (recruitment/exam वर) फक्त अस्तित्वात असलेल्या syllabus page कडेच point करावे — broken internal links पकडण्यासाठी validate.mjs path format check करते
- Topics object-format मध्येच (`{topic, points}`) — नंतर topic → questions mapping programmatic होईल
- `officialSyllabusUrl` guess करू नये — अधिकृत PDF खरी उपलब्ध असतानाच

**Relationship chain (core architecture):** `Exam → Syllabus → Subject → Topic → Question Bank → Mock Test`

## 3. Current Affairs Schema (base + खालील fields)

```jsonc
{
  "kind": "daily | monthly | oneliner",
  "date": "YYYY-MM-DD (kind=daily साठी)",
  "items": [
    {
      "id": "ca-2026-09-03-001",
      "question": "प्रश्न (one-liner format)",
      "answer": "उत्तर",
      "explanation": "short explanation | null",
      "category": "Appointments | Awards | Sports | Economy | Schemes | Defence | Science | Important Days | Environment | Maharashtra | India | World",
      "importance": "high | medium | low",
      "source": { "url": "…", "name": "…" } | null,
      "tags": ["…"]
    }
  ]
}
```

**Power of this structure:** एकाच `items[]` मधून **Article + One-liner sheet + Quiz + Mock Test + Question Bank** — पाचही outputs generate करता येतात. म्हणून `question/answer/explanation` बंडल करणे आवश्यक होते.

## 4. Exam Hub & Question Model (`data/exams/`, `data/questions/`, `data/mock-tests/`)

Exam hub record (base + `examNameMr`, `description`, `conductingBody`, `officialUrl`, `eligibility`, `pattern{stages,papers[]}`, `syllabusRef`, `sources[]`). Exam हे **hub** आहे — संपूर्ण content duplicate नाही; तो related records कडे links करतो.

### 4b. Question Bank Record (`data/questions/<exam>.json`)

एका exam चा संपूर्ण question bank — सर्व mock tests यातून reference करतात:

```jsonc
{
  "exam": "police-bharti | mpsc-rajyaseva …",
  "questions": [
    {
      "id": "police-bharti-q001",
      "question": "…",
      "options": [ { "id": "a", "text": "…" }, { "id": "b", "text": "…" } ],
      "correctAnswer": "b",            // string; one of options[].id (case-insensitive)
      "explanation": "…",              // required — नसल्यास generator प्रश्न घेणार नाही
      "subject": "…", "subjectId": "…",
      "topic": "…", "topicId": "…",    // stable topicId, संबंधित syllabus topic शी match हवा
      "difficulty": "easy|medium|hard",
      "exam": "…", "year": null, "source": "… | null", "tags": ["…"]
    }
  ]
}
```

**नियम:** structured `options[]` (optionA/optionB hardcode नाही). Question **एकदाच** bank मध्ये — test मध्ये कधीच copy नाही. `source` legitimate null असू शकतो (invent नाही).

### 4c. Mock Test Record (`data/mock-tests/<id>.json`)

```jsonc
{
  "id": "police-bharti-mock-01",
  "type": "mock-test",
  "title": "…", "titleMr": "…",
  "slug": "mock-test/police-bharti-mock-01",
  "path": "/mock-test/police-bharti-mock-01/",
  "category": "…", "exam": "…",
  "durationMinutes": 10,
  "status": "published",
  "fixture": true,
  "lastUpdatedAt": "…",
  "questionIds": [ "police-bharti-q001", "…" ]   // bank references — full questions इथे नको
}
```

**एक question → अनेक tests** valid reuse आहे (random/subject/previous-year tests साठी); duplicate question object test मध्ये कधीच नको.

## 11. Relationship Rules (definitive)

```
Exam ⇄ Syllabus            exam.syllabusRef → syllabus.path (तो record अस्तित्वात असेल तरच link)
Exam ⇄ Mock Test           mock-test.exam = exam.id  (generator फक्त existing tests links दाखवतो)
Exam ⇄ Recruitment         recruitment.exam = exam.id
Syllabus ⇄ Subject         syllabus.subjects[].subjectId (stable)
Subject ⇄ Topic            syllabus.topics[].topicId (stable, unique — whole syllabus objectives)
Topic ⇄ Question           question.topicId → syllabus topicId (संबंधित exam साठी)
Question ⇄ Mock Test       mock-test.questionIds[] → question.id
```

- Topic identifiers reusable (syllabus, question bank, mock tests, analytics, future recommendations)
- Generator + validator (validate.mjs) दोन्ही ही integrity enforce करतात
- Exam hub, syllabus page, mock test listing सर्व फक्त **existing related record** असतानाच फक्त link दाखवतात

## 5. Source Schema (`sources[]`) — provenance tracking

एक article अनेक official sources वापरू शकतो (notification + result + PDF). म्हणून array:

```jsonc
"sources": [
  { "url": "https://…", "name": "mahapolice.gov.in", "priority": 1,
    "role": "notification", "verifiedAt": "2026-09-03T…" },
  { "url": "https://…pdf", "name": "जाहिरात PDF", "priority": 1, "role": "notification-pdf" },
  { "url": "https://…", "name": "…", "priority": 2, "role": "result" }
]
```

`role` enum: `notification | notification-pdf | apply | result | answer-key | admit-card | syllabus | reference`.
`priority` = Source Priority System (1 official … 4 other — 01-ARCHITECTURE §6).

## 6. Update Schema (`updates[]`) — structured timeline

```jsonc
"updates": [
  {
    "date": "2026-02-01T09:00:00+05:30",
    "type": "notification | application-extended | admit-card | exam-date | answer-key | result | correction | other",
    "title": "अर्जाची शेवटची तारीख वाढवली",
    "summary": "05/02/2026 पर्यंत…",
    "source": { "url": "…", "name": "…" } | null
  }
]
```

Article वर यावरून **Latest Updates timeline** automated render होते. Duplicate protection: नवीन माहिती = नवीन record नाही, तर या array मध्ये entry + `lastUpdatedAt` bump.

## 7. Category record (`data/categories.json`)

```jsonc
{ "id": "…", "name": "…", "nameMr": "…", "path": "/…/",
  "nav": true, "contentType": "post", "description": "…" }
```

`contentType` = category metadata (कोणत्या प्रकारचे records यात जातात). Sitemap grouping logic generator मध्ये राहते — category data मध्ये नाही.

## 8. Site config (`data/site.json`)

```jsonc
{ "site": { "name", "url", "locale", "tagline", "description",
  "adsense": { "enabled": true },          // publisher ID इथे नाही — env: ADSENSE_PUB_ID
  "social": { … },
  "feeds": [ { "name", "url", "type", "category", "priority", "verified" } ] } }
```

- **Publisher ID कधीच public config मध्ये नाही** — build च्या वेळी `ADSENSE_PUB_ID` env/secret मधून येते; missing असल्यास AdSense head + ads.txt skip (build fail नाही).
- `feeds[].verified: false` असलेले feeds monitor कधीच fetch करत नाही — आधी manually verify करावेत (docs/04-AUTOMATION-DESIGN.md).

## 9. Migration mapping (unchanged from V1)

`posts/*.json → recruitment table`, `updates[] → recruitment_updates`, `sources[] → recruitment_sources`, `exams/*.json → exams`, `questions[] → questions`, `faqs[] → faqs`. JSON ↔ SQL 1:1 सुसंगत.

## 10. Validation invariants (generator + validate.mjs enforce करतात)

1. `path` = `'/' + slug + '/'` (nested असल्यास त्याच नियमाने)
2. `status ∈ enum`; फक्त `published|updated` render
3. `confidence` tier नुसार status restriction (docs/04)
4. `contentHash` = SHA-256 of stable-JSON({title, content, recruitment, dates, links})
5. Garbage strings / `\uXXXX`-escaped Devanagari / HTML-in-data → hard reject
6. Question शिवाय explanation → test मध्ये exclude
7. `updates[].type` ∈ enum; `sources[].role` ∈ enum



