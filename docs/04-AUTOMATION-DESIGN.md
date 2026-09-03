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
5. HTML-diff sources (RSS नसलेले official pages) — `type: "html"`, `selector` config सह; Phase 2

## 4. Review Workflow

```
monitor → draft (status: ai-generated, confidence: computed)
        → review-queue.json entry
        → HUMAN: record तपासा → fields भरा/दुरुस्त करा
        → status: published + confidence ≥ 85
        → पुढील build मध्ये site वर
```

Human approval चे साधन: `data/posts/<id>.json` edit करून commit (किंवा भविष्यात admin UI). Review queue entries जुन्या झाल्या की (14 दिवस) त्यांना `archived` flag — stale drafts कधीच live जाऊ नये.

## 5. Update Detection (change pipeline)

प्रत्येक monitor धावेळी:
1. Feed item → normalized title + link शी existing records शी match (शक्य असल्यास official URL match)
2. Match मिळाला आणि source content बदलला → record च्या `updates[]` मध्ये entry + `lastUpdatedAt` bump + hash recompute
3. Match नाही → नवीन draft
4. कधीच: नवीन record तयार करून duplicate/thin content वाढवू नये
