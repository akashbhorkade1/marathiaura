# MarathiAura

> **भरतीपासून निकालापर्यंत, सर्व माहिती एका ठिकाणी.**
> मराठी स्पर्धा परीक्षा platform — marathiaura.in

## Structure

```
docs/         Design documents (architecture, data schema, URL/sitemap strategy)
data/         "Database" — structured JSON records (site, categories, posts, exams, questions, pages)
automation/   Modular pipeline: monitor → validate → build (generators)
assets/       CSS + mock test engine (client-side)
```

## Commands

```bash
node automation/monitor.mjs   # sources monitor → drafts → review queue
node automation/validate.mjs  # quality checks + confidence adjust
node automation/build.mjs     # full site → _site/
```

## Automation flow

Official sources → **monitor** (RSS, duplicate detection) → **validate** (garbage/field/date/link checks) → confidence system (≥95% auto-publish · 85–94% review recommended · 70–84% manual review · <70% reject/hold) → **build** → GitHub Pages.

Drafts (`status: ai-generated`) render होत नाहीत — human review नंतर `status: published` केल्यावरच site वर येतात.

## Key rules

- फक्त अधिकृत स्रोतांवर आधारित माहिती; स्रोतात नसल्यास "माहिती अद्याप उपलब्ध नाही"
- एक भरती = एक canonical record; updates `updates[]` मध्ये
- Thin pages generate करण्यासाठी नाही — quality over quantity

See [docs/00-OVERVIEW.md](docs/00-OVERVIEW.md) for the full design.
