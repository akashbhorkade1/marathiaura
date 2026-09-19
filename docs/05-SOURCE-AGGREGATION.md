# MarathiAura – Source Aggregation System (docs/05)

> Trusted government recruitment information, rewritten clearly in Marathi from verified source data.
> हे reusable automation infrastructure आहे — one-off script नाही.

## 1. Approved Primary Source Registry (LEVEL 2)

| Source | URL | वापर | Feed type |
|---|---|---|---|
| MPSC | https://mpsc.gov.in/ | MPSC परीक्षा, जाहिराती, वेळापत्रके, निकाल, प्रवेशपत्र | html |
| Employment News | https://www.employmentnews.gov.in/ | केंद्र सरकार, PSU, विद्यापीठे, स्वायत्त संस्था | html |
| National Career Service | https://www.ncs.gov.in/ | सरकारी संधी, job listings, official ad links | html |

**Level hierarchy:** L1 = मूळ recruiting authority (official notification/portal) > L2 = MPSC/EmpNews/NCS > L3 = project-allowed other. Third-party blog कधीच L1 पेक्षा authoritative नाही.

- `data/site.json` मध्ये नवीन feed **नेहमी `verified: false`** — manual verification (URL fetch → structure → titles) नंतरच `true`; unverified feeds monitor कधीच fetch करत नाही.
- Source पूर्णपणे fetch अशक्य असल्यास → `unavailable` mark; दुसरा approved source वापरा; **fabricate कधीच नाही**.

## 2. Pipeline (§3, §26)

```
SOURCE → FETCH (monitor.mjs) → PARSE/NORMALIZE (normalize.mjs)
  → DEDUPLICATE (dedup.mjs) → VERIFY (verify-official.mjs)
  → ORIGINAL MARATHI (generate-original-mr.mjs) → VALIDATE (validate.mjs)
  → review-queue → human approve → build.mjs → sitemap+RSS → production
```

COPY → paraphrase-line-by-line → publish हा मार्ग **system मध्येच अस्तित्वात नाही** — generator फक्त normalized facts घेतो, source text घेतच नाही.

## 3. Modules

| Module | जबाबदारी |
|---|---|
| `automation/normalize.mjs` | Raw text → structured facts (§4). Missing = `null`; infer/probably/expected कधीच नाही. Marathi+English dates, vacancies, advt no., age, fee, qualification, organization, post names |
| `automation/dedup.mjs` | §6 deterministic key `org\|name\|advtNo\|post\|notificationUrl` + title-similarity fallback (किमान एक hard fact — advt/vacancies — जुळला तरच merge). `mergeFacts` = priority-aware; एक recruitment = एकच canonical record |
| `automation/verify-official.mjs` | §5 URL classification (https only; `.gov.in/.nic.in/.edu.in/.ac.in` = official), §7 conflict resolution (L1 > L2 > L3; समान priority + भिन्न → disputed = `null` + review), §24 polite HEAD/GET check (CAPTCHA/anti-bot bypass कधीच नाही) |
| `automation/generate-original-mr.mjs` | §8 structure (थोडक्यात माहिती → तुमच्यासाठी आहे का? → तारखा → शुल्क → अर्ज कसा), §9 style (लहान वाक्ये, natural English terms), §15 (filler कधीच नाही). `shingleSimilarity` copy-detection gate (5-gram Jaccard, threshold 0.45) |
| `automation/monitor.mjs` | Fetch + wire: item → normalize → dedup (merge त्याच draft मध्ये / update-candidate queue) → original draft. `provenance` block जपतो |
| `automation/validate.mjs` | §21 gates: official links valid + non-gov host as officialUrl नाही, fake urgency, placeholder language, visible null/undefined |

## 4. Update & Review model (§18, §23)

- एकाच recruitment दुसऱ्या source वर आढळला → **त्याच draft मध्येच merge** (`provenance.crossSources`), नवीन article नाही.
- **Published** record बदलला (मुदतवाढ, निकाल, प्रवेशपत्र) → auto-edit कधीच नाही; `review-queue` मध्ये `update:` candidate; human `review.mjs approve` नंतरच.
- Auto-publish फक्त high confidence + human approval नंतरच (docs/04 §1 tiers).

## 5. Provenance (§22) — internal only

```jsonc
"provenance": { "sourceName", "sourceUrl", "sourceType", "officialUrl", "officialNotificationUrl",
  "retrievedAt", "verifiedAt", "confidence", "contentHash", "copySimilarity", "flags[]", "crossSources[]", "priority" }
```

Public article ला फक्त: `स्रोत: [source name]` + `✅ माहिती तपासली: [date]` (फक्त खऱ्या `verifiedAt` वर) + `अंतिम माहिती संबंधित अधिकृत अधिसूचनेनुसार तपासा.`

## 6. Quality gate (§21) — publish FAIL if

official source नाही · title/org/post missing · source URL invalid · apply URL unverified · unresolvable conflict · hallucinated field · copied paragraph (similarity ≥ 0.45) · System.Xml/XmlElement/[object Object]/undefined/visible-null · fake urgency · expired active section मध्ये.

## 7. Tests (§25)

`node automation/test/source-aggregation.test.cjs` — 16 cases: MPSC new, EmpNews central, NCS minimal, 2-source + 3-source dedup, conflicting dates (L1 wins / समान priority → null), missing last date (ACTIVE, no countdown), expired → CLOSED, extended deadline (updates[] history, L1 wins), L1 provenance, invalid URL, XML leak, empty source, null vacancy, safe Marathi generation, copy-detection threshold.

Deploy पूर्वी: core + render + aggregation suites → `validate.mjs` → `build.mjs` (validate-output gate) — काहीही fail → deploy नाही.
