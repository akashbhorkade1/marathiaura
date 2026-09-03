# MarathiAura – Question Bank Design

## 1. Objective

Question Bank हा Mock Tests आणि future features (random tests, subject tests, previous-year tests, analytics, recommendations) चा **single source of truth** आहे. येथे प्रत्येक question **एकदाच** store होतो; tests फक्त `questionIds[]` reference करतात.

## 2. Question Lifecycle

```
Draft (किंवा automation/import) → Review → Published → Updated → Archived
```

- `data/questions/<exam>.json` मध्ये question published असेल तरच mock tests मध्ये वापरता येईल
- Question मध्ये बदल → त्याच्या सर्व referencing tests मध्ये आपोआप दिसेल (bank ⇒ test copy नसल्यामुळे)
- Delete करण्याऐवजी archive; references broken झाल्यास validator पकडतो

## 3. Question IDs

- Pattern: `<exam-prefix>-q<seq>`, उदा. `police-bharti-q001`, `mpsc-rajyaseva-q001`
- **Immutable** — एकदा published झाल्यावर बदलू नये (tests/references त्यावर अवलंबून)
- ID फक्त जोडले जाऊ शकते; रीक्रमांकन करू नये

## 4. Topic Mapping (stable topicIds)

प्रत्येक syllabus मध्ये subjects आणि topics चे **stable identifiers** असतात:

- `subjectId`: `marathi`, `mathematics`, `general-knowledge`, `reasoning`, `english`, `general-studies`
- `topicId`: `marathi-vyakaran`, `mathematics-ankan-ganit`, `general-knowledge-maharashtra-gk`, `reasoning-tarkik-kshamata`, …

नियम:
- Question चे `topicId` संबंधित exam च्या syllabus मधील topicId शी match असावे (validator checks)
- Free-text नोंदी टाळा — `"Percentage"`, `"percentage"`, `"टक्केवारी"` अशा variant ऐवजी एकच `mathematics-ankan-ganit`
- Topic rename करायची असल्यास → syllabus आणि सर्व questions एकत्र update करा

## 5. Source Attribution

- `source`: official/document reference string
- असल्यास ते अचूक असावे; **invent करू नये**
- दुर्मीळ/स्पष्ट उदा. साध्या गणितात `source: null` legitimate आहे — validator त्यावर hard-error करत नाही (फक्त warning/flag नाही)

## 6. Difficulty

`easy | medium | hard` फक्त. Question बदलल्यास difficulty संबंधित syllabus/chapter च्या level नुसार.

## 7. Reusability

```
Question Bank
   ├── Q001 ──────────────┐
   ├── Q002 ──────────────┤
   └── Q008 ──────────────┼── Mock Test A (Q001, Q002, Q008)
                          ├── Mock Test B (Q002, Q008, Q014)
   Question Q008 अनेक tests मध्ये reuse (valid) — copy नाही
```

- `data/questions/` = बँक; `data/mock-tests/` = फक्त `questionIds[]`
- Future: randomisation/subject/full-length tests ला हाच architecture

## 8. Duplicate Prevention

- Question ID unique (validator)
- Content-based: same `question` text दिसल्यास duplicate flag (future enhancement — separate)
- Mock test मधील `questionIds[]` मध्ये duplicate ID परवानगी नाही

## 9. Validation Summary (validate.mjs)

| Check | निकष |
|---|---|
| valid question fields | id, question, options[], correctAnswer, explanation, subjectId, topicId |
| options count | ≥2; unique option ids |
| correctAnswer | one of options[].id |
| difficulty | enum |
| exam ref | exam id data/exams मध्ये अस्तित्वात |
| duplicate question ID | bank मध्ये unique |
| topicId valid | संबंधित syllabus मध्ये अस्तित्वात |
| mock test references | प्रत्येक questionIds[] id bank मध्ये resolve |