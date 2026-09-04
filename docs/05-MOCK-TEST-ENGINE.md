# 05 — Mock Test Engine · Pure Core Contract

> Schema V2 frozen. This document defines the **pure test core** contract — the framework-independent, DOM-free, deterministic logic layer that powers the MarathiAura mock test experience.

## Architecture Boundary

The core owns **test-domain logic only**. The UI layer owns **rendering, timers, persistence, and browser APIs**.

```
UI Layer (mock-engine.js)  →  calls core, never mutates core state
Pure Core (test-core.js)   →  no DOM, no localStorage, no timers, no Date.now()
```

---

## State Model

```js
TestState = {
  testId: string,
  questionIds: string[],           // order matters; resolved at runtime
  currentQuestionIndex: number,    // 0-based, clamped to [0, len-1]
  answers: { [questionId]: string }, // optionId (lowercase) per question
  visited: { [questionId]: boolean },
  submitted: boolean,
  startedAt: number | null,        // epoch ms; set when test begins
  completedAt: number | null,      // epoch ms; set on submit
  durationSeconds: number          // derived from test.durationMinutes * 60
}
```

**Immutability:** Every core function returns a **new state object**. Input state is never mutated.

---

## Exported API

| Function | Signature | Behavior |
|---|---|---|
| `createInitialState` | `(test) → State` | Validates questionIds (non-empty, unique), duration (positive). Throws on invalid. |
| `selectAnswer` | `(state, questionId, optionId) → State` | Records answer (lowercased), marks visited. Throws if unknown questionId or submitted. |
| `clearAnswer` | `(state, questionId) → State` | Removes answer; visited flag preserved. Throws if unknown or submitted. |
| `markVisited` | `(state, questionId) → State` | Marks question visited without answering. Throws if submitted. |
| `goNext` | `(state, questionCount?) → State` | Advances index by 1, clamped to last question. |
| `goPrevious` | `(state) → State` | Decrements index by 1, clamped to 0. |
| `goToQuestion` | `(state, index, questionCount?) → State` | Jumps to index, clamped to valid range. |
| `getQuestionStatus` | `(state, questionId, currentIndex?) → string` | Returns `current` / `answered` / `visited-unanswered` / `unvisited`. |
| `calculateResult` | `(state, test, questions) → Result` | Computes score, accuracy, breakdowns. |
| `buildReview` | `(state, test, questions) → ReviewItem[]` | Per-question review records with selected/correct options. |
| `submitTest` | `(state, test, questions, completedAt?) → {state, result, review}` | Idempotent. Marks submitted, freezes state. |
| `remainingSeconds` | `(startedAt, durationSeconds, now) → number` | Countdown in seconds, clamped to >= 0. |
| `isExpired` | `(startedAt, durationSeconds, now) → boolean` | `true` when `now >= deadline`. |

---

## Question Status Derivation

Priority order (first match wins):

1. `current` — question is at `currentQuestionIndex`
2. `answered` — `answers[questionId]` is set
3. `visited-unanswered` — `visited[questionId]` is true but no answer
4. `unvisited` — none of the above

---

## Scoring Math

**Source of truth:** `test.marking` object (NEVER inferred from exam name).

```
marking = { correct: number (default 1), wrong: number (default 0, must be <= 0) }

maxScore       = totalQuestions x marking.correct
positiveMarks  = correctCount x marking.correct
negativeMarks  = incorrectCount x marking.wrong
score          = positiveMarks + negativeMarks
percentage     = maxScore > 0 ? (score / maxScore) x 100 : 0
accuracy       = attempted > 0 ? (correctCount / attempted) x 100 : 0
attempted      = correctCount + incorrectCount
```

**Key distinction:** `percentage` reflects **marks earned vs maximum** (affected by negative marking). `accuracy` reflects **correctness among attempted questions** (unaffected by marking weights).

**Example:** 10 questions, +1/-0.25 marking, 8 attempted, 6 correct, 2 wrong:
- `score = 6 - 0.5 = 5.5`
- `percentage = 55%`
- `accuracy = 75%`

**Zero-division safety:** `accuracy = 0` when `attempted = 0`. `percentage = 0` when `maxScore = 0`.


---

## Review Record Shape

```js
ReviewItem = {
  questionId: string,
  number: number,                 // 1-based position
  question: string,
  selectedOption: { id: string, text: string } | null,
  correctOption: { id: string, text: string } | null,
  resultStatus: 'correct' | 'incorrect' | 'unanswered',
  explanation: string | null,     // from question bank; null if unavailable
  subject: string | null,
  topic: string | null            // topicId preferred, falls back to topic
}
```

---

## Timer Design (Dependency Injection)

The core **never** accesses `Date.now()` or `setInterval`. Time is injected via `now` parameter:

```js
remainingSeconds(startedAt, durationSeconds, now)  // -> clamped >= 0
isExpired(startedAt, durationSeconds, now)         // -> boolean
```

The UI layer owns the interval and passes `Date.now()` as `now`. This keeps the core **deterministic and Node-testable**.

---

## Error Policy

| Condition | Response |
|---|---|
| Unknown questionId | `RangeError` |
| Unknown optionId | stored as-is (normalization only) |
| Mutation after submit | `Error` ("test already submitted") |
| Empty questionIds | `Error` at `createInitialState` |
| Duplicate questionIds | `Error` at `createInitialState` |
| Invalid duration (<= 0) | `Error` at `createInitialState` |
| `marking.wrong > 0` | `Error` at `calculateResult` |
| Navigation out-of-range | **clamp** (not throw) |

---

## Data Contract

- Consumes **Schema V2** mock-test records (`questionIds[]`, `marking`, `durationMinutes`).
- Consumes **Schema V2** question bank records (`id`, `question`, `options[]`, `correctAnswer`, `explanation`, `subject`, `topicId`).
- **References only** — never duplicates question content into mock-test records.
- Compatible with both browser (`window.TestCore`) and Node (`module.exports`) via UMD wrapper.

---

## Test Coverage

`automation/test/test-core.test.cjs` — 34 assertions across:
- State creation & validation
- Answer selection, change, clear, immutability
- Navigation boundaries & preservation
- Scoring (all-correct, all-wrong, mixed, negative marking, zero-attempted)
- Accuracy (zero-attempted, distinct from percentage)
- Review records (correct/incorrect/unanswered, explanation)
- Timer helpers (zero/partial/expiry/post-expiry)
- Submission (idempotent, post-submit mutation guard)

Run: `node --test automation/test/`

---

## Future Extensions (NOT in this phase)

- Timer engine (UI layer)
- sessionStorage persistence (UI layer)
- Question palette component (UI layer)
- Submit confirmation modal (UI layer)
- Review filters (UI layer)
- User accounts / server-side attempts
- Randomization engine
- Analytics dashboard
