/* MarathiAura — Pure Test Core · Node test suite
 * Run: node --test automation/test/
 * Covers: state, answers, navigation, scoring, accuracy, review, timer, submission, status
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const TC = require('../../assets/js/test-core.js');

/* ---------- fixtures (Schema V2 shapes; references only) ---------- */
const QUESTIONS = [
  { id: 'q-001', question: 'प्रश्न १?', options: [{ id: 'a', text: 'अ' }, { id: 'b', text: 'ब' }, { id: 'c', text: 'क' }, { id: 'd', text: 'ड' }], correctAnswer: 'b', explanation: 'स्पष्टीकरण १', subject: 'marathi', topicId: 'marathi-vyakaran' },
  { id: 'q-002', question: 'प्रश्न २?', options: [{ id: 'a', text: 'अ' }, { id: 'b', text: 'ब' }, { id: 'c', text: 'क' }, { id: 'd', text: 'ड' }], correctAnswer: 'a', explanation: 'स्पष्टीकरण २', subject: 'math', topicId: 'math-percentage' },
  { id: 'q-003', question: 'प्रश्न ३?', options: [{ id: 'a', text: 'अ' }, { id: 'b', text: 'ब' }, { id: 'c', text: 'क' }, { id: 'd', text: 'ड' }], correctAnswer: 'd', explanation: null, subject: 'gk', topicId: 'gk-maharashtra' },
  { id: 'q-004', question: 'प्रश्न ४?', options: [{ id: 'a', text: 'अ' }, { id: 'b', text: 'ब' }, { id: 'c', text: 'क' }, { id: 'd', text: 'ड' }], correctAnswer: 'c', explanation: 'स्पष्टीकरण ४', subject: 'reasoning', topicId: 'reasoning-series' }
];
const TEST = { id: 't-1', questionIds: ['q-001', 'q-002', 'q-003', 'q-004'], durationMinutes: 5, marking: { correct: 1, wrong: -0.25, unattempted: 0 } };
const TEST_NONEG = { id: 't-2', questionIds: ['q-001', 'q-002'], durationMinutes: 2, marking: { correct: 2, wrong: 0, unattempted: 0 } };

/* ================= STATE ================= */
test('state: initial shape', () => {
  const s = TC.createInitialState(TEST);
  assert.equal(s.testId, 't-1');
  assert.equal(s.currentQuestionIndex, 0);
  assert.deepEqual(s.answers, {});
  assert.deepEqual(s.visited, {});
  assert.equal(s.submitted, false);
  assert.equal(s.startedAt, null);
  assert.equal(s.durationSeconds, 300);
  assert.deepEqual(s.questionIds, ['q-001', 'q-002', 'q-003', 'q-004']);
});
test('state: empty questionIds throws', () => {
  assert.throws(() => TC.createInitialState({ id: 'x', questionIds: [], durationMinutes: 5 }));
});
test('state: duplicate questionIds throws', () => {
  assert.throws(() => TC.createInitialState({ id: 'x', questionIds: ['q-001', 'q-001'], durationMinutes: 5 }));
});
test('state: invalid duration throws', () => {
  assert.throws(() => TC.createInitialState({ id: 'x', questionIds: ['q-001'], durationMinutes: 0 }));
  assert.throws(() => TC.createInitialState({ id: 'x', questionIds: ['q-001'], durationMinutes: -3 }));
});

/* ================= ANSWER ================= */
test('answer: select marks answered + visited', () => {
  const s = TC.selectAnswer(TC.createInitialState(TEST), 'q-001', 'b');
  assert.equal(s.answers['q-001'], 'b');
  assert.equal(s.visited['q-001'], true);
});
test('answer: change replaces previous', () => {
  let s = TC.createInitialState(TEST);
  s = TC.selectAnswer(s, 'q-001', 'a');
  s = TC.selectAnswer(s, 'q-001', 'c');
  assert.equal(s.answers['q-001'], 'c');
});
test('answer: clear removes answer but keeps visited', () => {
  let s = TC.createInitialState(TEST);
  s = TC.selectAnswer(s, 'q-001', 'a');
  s = TC.clearAnswer(s, 'q-001');
  assert.equal(s.answers['q-001'], undefined);
  assert.equal(s.visited['q-001'], true);
});
test('answer: unknown questionId throws RangeError', () => {
  assert.throws(() => TC.selectAnswer(TC.createInitialState(TEST), 'q-999', 'a'), RangeError);
});
test('answer: option id normalized to lowercase', () => {
  const s = TC.selectAnswer(TC.createInitialState(TEST), 'q-001', 'B');
  assert.equal(s.answers['q-001'], 'b');
});
test('answer: immutability — input state not mutated', () => {
  const s0 = TC.createInitialState(TEST);
  const s1 = TC.selectAnswer(s0, 'q-001', 'a');
  assert.deepEqual(s0.answers, {});
  assert.notEqual(s0, s1);
});

/* ================= NAVIGATION ================= */
test('nav: next from first', () => {
  const s = TC.goNext(TC.createInitialState(TEST));
  assert.equal(s.currentQuestionIndex, 1);
});
test('nav: previous from first clamps to 0', () => {
  const s = TC.goPrevious(TC.createInitialState(TEST));
  assert.equal(s.currentQuestionIndex, 0);
});
test('nav: next from last clamps to last', () => {
  let s = TC.goToQuestion(TC.createInitialState(TEST), 3);
  s = TC.goNext(s);
  assert.equal(s.currentQuestionIndex, 3);
});
test('nav: goToQuestion clamps out-of-range', () => {
  assert.equal(TC.goToQuestion(TC.createInitialState(TEST), -5).currentQuestionIndex, 0);
  assert.equal(TC.goToQuestion(TC.createInitialState(TEST), 99).currentQuestionIndex, 3);
});
test('nav: navigation preserves answers', () => {

/* ================= STATUS ================= */
test('status: unvisited to visited-unanswered to answered to current', () => {
  let s = TC.createInitialState(TEST);
  assert.equal(TC.getQuestionStatus(s, 'q-002', 0), 'unvisited');
  s = TC.markVisited(s, 'q-002');
  assert.equal(TC.getQuestionStatus(s, 'q-002', 0), 'visited-unanswered');
  s = TC.selectAnswer(s, 'q-002', 'a');
  assert.equal(TC.getQuestionStatus(s, 'q-002', 0), 'answered');
  assert.equal(TC.getQuestionStatus(s, 'q-002', 1), 'current');
});
test('status: unknown questionId throws', () => {
  assert.throws(() => TC.getQuestionStatus(TC.createInitialState(TEST), 'q-999', 0), RangeError);
});

/* ================= SCORING ================= */
test('scoring: all correct', () => {
  let s = TC.createInitialState(TEST);
  s = TC.selectAnswer(s, 'q-001', 'b');
  s = TC.selectAnswer(s, 'q-002', 'a');
  s = TC.selectAnswer(s, 'q-003', 'd');
  s = TC.selectAnswer(s, 'q-004', 'c');
  const r = TC.calculateResult(s, TEST, QUESTIONS);
  assert.equal(r.correct, 4); assert.equal(r.incorrect, 0); assert.equal(r.unanswered, 0);
  assert.equal(r.score, 4); assert.equal(r.maxScore, 4);
  assert.equal(r.percentage, 100); assert.equal(r.accuracy, 100);
});
test('scoring: all wrong (negative marking -1)', () => {
  let s = TC.createInitialState(TEST);
  s = TC.selectAnswer(s, 'q-001', 'a');
  s = TC.selectAnswer(s, 'q-002', 'b');
  s = TC.selectAnswer(s, 'q-003', 'a');
  s = TC.selectAnswer(s, 'q-004', 'a');
  const r = TC.calculateResult(s, TEST, QUESTIONS);
  assert.equal(r.correct, 0); assert.equal(r.incorrect, 4);
  assert.equal(r.score, -1); assert.equal(r.negativeMarks, -1);
  assert.equal(r.percentage, -25); assert.equal(r.accuracy, 0);
});
test('scoring: mixed 2C/1W/1U of 4', () => {
  let s = TC.createInitialState(TEST);
  s = TC.selectAnswer(s, 'q-001', 'b'); // correct
  s = TC.selectAnswer(s, 'q-002', 'a'); // correct
  s = TC.selectAnswer(s, 'q-003', 'a'); // wrong
  // q-004 unanswered
  const r = TC.calculateResult(s, TEST, QUESTIONS);
  assert.equal(r.correct, 2); assert.equal(r.incorrect, 1); assert.equal(r.unanswered, 1);
  assert.equal(r.attempted, 3);
  assert.equal(r.score, 1.75); // 2 - 0.25
  assert.equal(r.accuracy, (2 / 3) * 100);
  assert.equal(r.percentage, (1.75 / 4) * 100);
});
test('scoring: all unanswered → zero attempted', () => {
  const r = TC.calculateResult(TC.createInitialState(TEST), TEST, QUESTIONS);
  assert.equal(r.attempted, 0); assert.equal(r.unanswered, 4);
  assert.equal(r.score, 0); assert.equal(r.accuracy, 0); assert.equal(r.percentage, 0);
});
test('scoring: no-negative marking config respected', () => {
  let s = TC.createInitialState(TEST_NONEG);
  s = TC.selectAnswer(s, 'q-001', 'a'); // wrong
  s = TC.selectAnswer(s, 'q-002', 'a'); // correct
  const r = TC.calculateResult(s, TEST_NONEG, QUESTIONS);
  assert.equal(r.score, 2); assert.equal(r.maxScore, 4); assert.equal(r.percentage, 50);
});
test('scoring: marking.wrong > 0 throws', () => {

/* ================= ACCURACY ================= */
test('accuracy: zero attempted → 0 (no divide-by-zero)', () => {
  const r = TC.calculateResult(TC.createInitialState(TEST), TEST, QUESTIONS);
  assert.equal(r.accuracy, 0);
});
test('accuracy: distinct from percentage under negative marking', () => {
  let s = TC.createInitialState(TEST);
  s = TC.selectAnswer(s, 'q-001', 'b'); // correct
  s = TC.selectAnswer(s, 'q-002', 'b'); // wrong
  const r = TC.calculateResult(s, TEST, QUESTIONS);
  assert.equal(r.accuracy, 50);
  assert.equal(r.score, 0.75);
  assert.equal(r.percentage, 18.75);
});

/* ================= REVIEW ================= */
test('review: correct / incorrect / unanswered records', () => {
  let s = TC.createInitialState(TEST);
  s = TC.selectAnswer(s, 'q-001', 'b'); // correct
  s = TC.selectAnswer(s, 'q-002', 'b'); // wrong
  const rev = TC.buildReview(s, TEST, QUESTIONS);
  assert.equal(rev.length, 4);
  assert.equal(rev[0].resultStatus, 'correct');
  assert.equal(rev[0].selectedOption.id, 'b');
  assert.equal(rev[0].correctOption.id, 'b');
  assert.equal(rev[1].resultStatus, 'incorrect');
  assert.equal(rev[1].correctOption.id, 'a');
  assert.equal(rev[2].resultStatus, 'unanswered');
  assert.equal(rev[2].selectedOption, null);
  assert.equal(rev[2].explanation, null);
  assert.equal(rev[0].explanation, 'स्पष्टीकरण १');
  assert.equal(rev[0].topic, 'marathi-vyakaran');
});

/* ================= TIMER ================= */
test('timer: zero elapsed → full duration', () => {
  assert.equal(TC.remainingSeconds(1000, 300, 1000), 300);
});
test('timer: partial elapsed', () => {
  assert.equal(TC.remainingSeconds(0, 300, 60000), 240);
});
test('timer: exact expiry → 0 and expired', () => {
  assert.equal(TC.remainingSeconds(0, 300, 300000), 0);
  assert.equal(TC.isExpired(0, 300, 300000), true);
});
test('timer: post-expiry clamps to 0, never negative', () => {
  assert.equal(TC.remainingSeconds(0, 300, 999999), 0);
  assert.equal(TC.isExpired(0, 300, 999999), true);
});
test('timer: not expired before deadline', () => {
  assert.equal(TC.isExpired(0, 300, 299999), false);
});

/* ================= SUBMISSION ================= */
test('submit: marks submitted + completedAt, returns result+review', () => {
  let s = TC.createInitialState(TEST);
  s = TC.selectAnswer(s, 'q-001', 'b');
  const out = TC.submitTest(s, TEST, QUESTIONS, 12345);
  assert.equal(out.state.submitted, true);
  assert.equal(out.state.completedAt, 12345);
  assert.equal(out.result.correct, 1);
  assert.equal(out.review.length, 4);
});
test('submit: mutation after submit throws', () => {
  const out = TC.submitTest(TC.createInitialState(TEST), TEST, QUESTIONS);
  assert.throws(() => TC.selectAnswer(out.state, 'q-001', 'a'));
  assert.throws(() => TC.clearAnswer(out.state, 'q-001'));
  assert.throws(() => TC.markVisited(out.state, 'q-001'));
});
test('submit: idempotent — resubmit returns same state', () => {
  const out1 = TC.submitTest(TC.createInitialState(TEST), TEST, QUESTIONS);
  const out2 = TC.submitTest(out1.state, TEST, QUESTIONS);
  assert.equal(out2.state, out1.state);
});

  const bad = { id: 'b', questionIds: ['q-001'], durationMinutes: 1, marking: { correct: 1, wrong: 0.5 } };
  assert.throws(() => TC.calculateResult(TC.createInitialState(bad), bad, QUESTIONS));
});

  let s = TC.createInitialState(TEST);
  s = TC.selectAnswer(s, 'q-001', 'b');
  s = TC.goNext(s); s = TC.goNext(s); s = TC.goPrevious(s);
  assert.equal(s.answers['q-001'], 'b');
  assert.equal(s.currentQuestionIndex, 1);
});
