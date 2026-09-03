# MarathiAura – Data Schema (Database Design)

तत्वात: **JSON files = database**. प्रत्येक record चा schema future SQL/NoDB migration साठी डिझाइन केला आहे (प्रत्येक field खाली future table/column mapping सह दिला आहे). File layout पहा [01-ARCHITECTURE.md §3](01-ARCHITECTURE.md).

## 1. `data/site.json` – Site Config

```json
{
  "site": {
    "name": "MarathiAura",
    "url": "https://marathiaura.in",
    "locale": "mr_IN",
    "tagline": "भरतीपासून निकालापर्यांत, सर्व माहिती एका ठिकाणी",
    "adsense": {
      "publisherId": "ca-pub-XXXXXXXXXXXXXXXX",
      "enabled": true
    },
    "social": {
      "telegram": "https://t.me/…",
      "whatsapp": "https://whatsapp.com/channel/…",
      "youtube": "https://www.youtube.com/@…"
    },
    "feeds": [
      { "name": "MPSC", "url": "https://mpsc.gov.in/…", "type": "rss", "category": "mpsc", "priority": 1 }
    ]
  }
}
```

> **AdSense publisher ID इथेच एका जागी** — templates generator `site.adsense.publisherId` वाचतील, 500+ files मध्ये hardcoded कधीच नाही. `ads.txt` file पण या value वरून generate होईल.

## 2. `data/categories.json` – Categories

```json
[
  {
    "id": "police-bharti",
    "name": "Police Bharti",
    "nameMr": "पोलीस भरती",
    "path": "/police-bharti/",
    "description": "महाराष्ट्र पोलीस भरती 2026, SRPF, Jail Police — जाहिरात, पात्रता, अभ्यासक्रम",
    "sitemap": "bharti"
  }
]
```

Planned categories: `latest-bharti`, `mpsc`, `police-bharti`, `talathi`, `gramsevak`, `maharashtra-bharti`, `ssc`, `railway`, `banking`, `syllabus`, `answer-key`, `result`, `admit-card`, `current-affairs`, `previous-papers`, `study-material`, `maharashtra-gk`, `yojna`.

## 3. Recruitment / Post Record (`data/posts/<id>.json`) — Canonical Model

एक bharti = **एकच record**. Updates नवीन record नाही, तर `updates[]` मध्ये.

```json
{
  "id": "police-bharti-2026-maharashtra",
  "type": "recruitment",
  "title": "Police Bharti 2026: महाराष्ट्र पोलीस भरतीची नवीन जाहिरात, पात्रता, अर्ज आणि शेवटची तारीख",
  "slug": "/police-bharti-2026/",
  "category": "police-bharti",
  "exam": "police-constable",
  "department": "महाराष्ट्र पोलीस विभाग",

  "recruitment": {
    "postNames": ["Police Constable", "SRPF Constable"],
    "vacancies": 18000,
    "vacanciesNote": null,
    "qualification": ["12वी पास"],
    "ageLimit": { "min": 18, "max": 28, "relaxation": "आरक्षित वर्गासाठी नियमानुसार" },
    "salary": { "payScale": "₹21,700 – ₹69,100 (Level 3)", "note": null },
    "fee": { "general": 450, "reserved": 350, "note": null },
    "applicationMode": "Online",
    "location": "महाराष्ट्र",
    "jobType": "government"
  },

  "dates": {
    "notification": "2026-01-10",
    "applicationStart": "2026-01-20",
    "applicationEnd": "2026-02-10",
    "examDate": null,
    "admitCardDate": null,
    "resultDate": null
  },

  "links": {
    "notificationUrl": "https://…/notification.pdf",
    "applyUrl": "https://…/apply",
    "officialUrl": "https://www.mahapolice.gov.in"
  },

  "selectionProcess": ["Physical Test", "Written Exam", "Medical", "Merit List"],
  "syllabusRef": "/police-bharti-syllabus/",
  "relatedMockTests": ["police-bharti-mock-01"],

  "content": {
    "shortDesc": "…~300 chars genuine summary…",
    "metaDescription": "…",
    "sections": [
      { "heading": "सविस्तर माहिती", "type": "text", "body": "…" },
      { "heading": "महत्वाच्या तारखा", "type": "table", "headers": ["घटना","तारीख"], "rows": [["अर्ज सुरू","20/01/2026"]] },
      { "heading": "पात्रता", "type": "list", "items": ["…"] }
    ],
    "faqs": [
      { "q": "Police Bharti साठी qualification काय आहे?", "a": "…" }
    ]
  },

  "source": {
    "url": "https://…/notification.pdf",
    "name": "mahapolice.gov.in",
    "priority": 1
  },

  "status": "published",
  "confidence": 97,
  "publishedAt": "2026-01-10T18:30:00+05:30",
  "lastUpdatedAt": "2026-02-01T09:00:00+05:30",
  "contentHash": "sha256:…",

  "updates": [
    {
      "date": "2026-02-01T09:00:00+05:30",
      "note": "अर्जाची शेवटची तारीख 05/02/2026 पर्यंत वाढवली आहे",
      "sourceUrl": "https://…"
    }
  ],

  "seo": {
    "keywords": ["Police Bharti 2026", "पोलीस भरती 2026", "…"],
    "ogImage": "/og-images/police-bharti-2026-maharashtra.svg",
    "index": true
  }
}
```

## 4. Exam Hub Record (`data/exams/<exam-id>.json`)

```json
{
  "id": "mpsc-rajyaseva",
  "examName": "MPSC Rajyaseva",
  "examNameMr": "राज्यसेवा संयुक्त परीक्षा",
  "category": "mpsc",
  "slug": "/mpsc/rajyaseva/",
  "officialUrl": "https://mpsc.gov.in",
  "conductingBody": "महाराष्ट्र लोकसेवा आयोग",
  "eligibility": { "education": "पदवीधर", "ageLimit": { "min": 19, "max": 38 } },
  "pattern": {
    "stages": ["Prelims", "Mains", "Interview"],
    "papers": [
      { "name": "Prelims Paper 1", "questions": 100, "marks": 200, "duration": "2 तास", "negativeMarking": "1/4" }
    ]
  },
  "syllabus": {
    "subjects": [
      { "subject": "Marathi", "topics": ["व्याकरण", "साहित्य", "…"] }
    ]
  },
  "status": "published",
  "lastUpdatedAt": "2026-03-01T00:00:00+05:30"
}
```

## 5. Mock Test Question Record (`data/questions/<exam>.json`)

प्रत्येक प्रश्न fully structured (future automated test generation साठी):

```json
{
  "testId": "police-bharti-mock-01",
  "exam": "police-bharti",
  "title": "Police Bharti Mock Test 01",
  "durationMinutes": 30,
  "questions": [
    {
      "qid": "police-bharti-mock-01-q001",
      "question": "महाराष्ट्राचे राज्यपाल कोण आहेत?",
      "options": { "A": "…", "B": "…", "C": "…", "D": "…" },
      "correctAnswer": "C",
      "explanation": "…संदर्भासह स्पष्टीकरण…",
      "subject": "Maharashtra GK",
      "topic": "शासन व्यवस्था",
      "difficulty": "easy",
      "year": null,
      "source": "Standard reference / official material"
    }
  ]
}
```

**नियम:** प्रत्येक प्रश्नाला explanation + source हवा. Explanation नसलेला प्रश्न generator test मध्ये घेणार नाही.

## 6. Current Affairs Record (`data/posts/<date>-ca.json`)

```json
{
  "id": "current-affairs-2026-03-01",
  "type": "current-affairs",
  "kind": "daily",
  "date": "2026-03-01",
  "items": [
    { "category": "Appointments", "q": "भारताचे नवे … कोण?", "a": "…", "note": "…" }
  ]
}
```

`kind`: `daily` | `monthly` | `oneliner`.

## 7. Status Workflow (Content Status System)

```
Draft → AI-Generated → Under-Review → Verified → Published → Updated (loop) → Archived
```

Generator फक्त `status: "published"` किंवा `"updated"` असलेली records render करतो.

## 8. Confidence & Validation Rules

| Check | निकष |
|---|---|
| Date validation | भविष्यातील/invalid तारखा → flag |
| Vacancy validation | संख्या source मध्ये नसेल तर `vacancies: null` — guess कधीच नाही |
| Link validation | `applyUrl`, `notificationUrl` HTTP 200 आणि domain official असावेत |
| Duplicate detection | normalized title + official URL + content hash |
| Missing fields | आवश्यक fields missing → confidence −, review queue |
| Contradiction | dates/fees source मध्ये conflicts → manual only |

## 9. Future SQL Migration Mapping (Phase 3 Reference)

| JSON field | Future table.column |
|---|---|
| `posts/*.json` | `recruitment` table (id, title, department, exam, post, vacancies, qualification, age_limit, salary, application_start, application_end, exam_date, notification_url, apply_url, official_url, source, status, last_updated) |
| `updates[]` | `recruitment_updates` (recruitment_id, note, source_url, created_at) |
| `exams/*.json` | `exams` (id, exam_name, category, syllabus, pattern, official_url) |
| `questions[]` | `questions` (id, exam, subject, topic, question, options, correct_answer, explanation, difficulty, year, source) |
| `faqs[]` | `faqs` (post_id, question, answer) |

JSON structure आणि SQL columns सुसंगत ठेवले तर migration = फक्त import script; generators फक्त data-source बदलतील.

## 10. Data Integrity नियम (सर्वसाधारण)

1. कोणतेही field `null` असू शकते पण **"System.Xml.XmlElement" / placeholder garbage कधीच नको** — validation टप्प्यावर पकडायचे.
2. Marathi text नेहमी UTF-8 (no BOM), Devanagari कधीच `\uXXXX` escape करू नये.
3. प्रत्येक record चा `contentHash` ठेवून change-detection reliable होईल.
4. External content कधीच HTML म्हणून store करू नये — text-only, रेंडरच्या वेळी escape.

