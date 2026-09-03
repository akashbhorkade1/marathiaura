# MarathiAura – Project Overview

> **MarathiAura – भरतीपासून निकालापर्यांत, सर्व माहिती एका ठिकाणी.**

Marathi-first स्पर्धा परीक्षा (Competitive Exam) platform — महाराष्ट्रातील MPSC, Police, Talathi, ZP आणि All-India (SSC / Railway / Banking) परीक्षांच्या तयारीसाठी.

## Design Documents Index

| Document | विषय |
|---|---|
| [01-ARCHITECTURE.md](01-ARCHITECTURE.md) | System architecture, stack decision, automation pipeline, repo structure |
| [02-DATA-SCHEMA.md](02-DATA-SCHEMA.md) | Database design (JSON records), field definitions, status/confidence workflow |
| [03-URL-STRUCTURE-AND-SITEMAP.md](03-URL-STRUCTURE-AND-SITEMAP.md) | URL rules, route map, sitemap strategy, robots, canonical policy |

## तीन मुख्य Pillars

| Pillar | Content | Automation चे काम |
|---|---|---|
| **INFORM** | Latest Bharti, Exam Updates, Results, Admit Cards, Answer Keys | Official sources monitor → detect → extract → publish |
| **PREPARE** | Syllabus, Notes, Current Affairs, Previous Papers | Semi-automated drafts + human review |
| **PRACTICE** | Mock Tests, Question Banks, Solutions, Analysis | Structured question bank → client-side test engine |

## Development Phases

- **Phase 1 (Launch):** Latest Bharti, MPSC, Police Bharti, Talathi, Syllabus, Current Affairs, Mock Tests (basic)
- **Phase 2:** SSC, Railway, Banking, Previous Papers, Result / Admit Card / Answer Key sections
- **Phase 3:** Advanced test platform, notifications (push/Telegram/WhatsApp), user accounts, performance analytics

## Core Development Principles

1. Mobile First
2. SEO First Architecture
3. Automation First Data Structure
4. Official Source First
5. Quality over Quantity
6. User Experience over Ads
7. Reusable Components
8. Structured Data
9. Human Review for High-Risk Facts
10. Scalable Architecture

## सर्वात महत्त्वाचा नियम

> Automation चा उद्देश "जास्तीत जास्त content बनवणे" नाही.
> Automation चा उद्देश: **जास्तीत जास्त useful, accurate आणि timely content कमी manual effort मध्ये publish करणे.**

- AI = processing layer, information source नाही.
- Official source = factual authority.
- Source मध्ये माहिती नसेल तर **"माहिती अद्याप उपलब्ध नाही"** दाखवायचे — guess कधीच नाही.
- Thin / duplicate pages तयार करू नये — एक canonical article + updates मॉडेल.
