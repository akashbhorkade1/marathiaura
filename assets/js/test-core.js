/* MarathiAura — Pure Test Core
 * Framework-independent · browser + Node (UMD)
 * No DOM · no localStorage · no timers · no Date.now() · no side effects
 * Consumes Schema V2 mock-test + question-bank structures (references only).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.TestCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function fail(msg) { throw new Error(msg); }

  /* ---------- helpers ---------- */
  function freshState(state, patch) {
     return Object.assign({}, state, patch, {
       answers: patch.answers !== undefined ? patch.answers : Object.assign({}, state.answers),
       visited: patch.visited !== undefined ? patch.visited : Object.assign({}, state.visited)
     });
   }
   function normalizeOptionId(o) { return String(o && o.id != null ? o.id : '').toLowerCase().trim(); }
   function normalizeQId(q) { return typeof q === 'string' ? q.trim() : String(q && q.id != null ? q.id : '').trim(); }
  function normalizeOptionId(o) { return String(o && o.id != null ? o.id : '').toLowerCase().trim(); }
  function normalizeQId(q) { return typeof q === 'string' ? q.trim() : String(q && q.id != null ? q.id : '').trim(); }

  /* ---------- createInitialState ---------- */
  function createInitialState(test) {
    if (!test) fail('createInitialState: missing test');
    const qids = (test.questionIds || []).map(normalizeQId);
    if (!qids.length) fail('createInitialState: no questionIds');
    const seen = new Set(qids);
    if (seen.size !== qids.length) fail('createInitialState: duplicate questionIds');
    const dur = test.durationMinutes;
    if (!Number.isFinite(dur) || dur <= 0) fail('createInitialState: invalid durationMinutes');
    return {
      testId: test.id,
      questionIds: qids.slice(),
      currentQuestionIndex: 0,
      answers: {},
      visited: {},
      submitted: false,
      startedAt: null,
      completedAt: null,
      durationSeconds: dur * 60
    };
  }
  /* ---------- answer handling ---------- */
  function requireOpen(state) { if (state.submitted) fail('test already submitted'); }
  function requireQid(state, qid) {
    if (state.questionIds.indexOf(qid) === -1) throw new RangeError('unknown questionId: ' + qid);
  }
  function selectAnswer(state, qid, optionId) {
    requireOpen(state); requireQid(state, qid);
    const answers = Object.assign({}, state.answers); answers[qid] = normalizeOptionId({ id: optionId });
    const visited = Object.assign({}, state.visited); visited[qid] = true;
    return freshState(state, { answers: answers, visited: visited });
  }
  function clearAnswer(state, qid) {
    requireOpen(state); requireQid(state, qid);
    const answers = Object.assign({}, state.answers); delete answers[qid];
    return freshState(state, { answers: answers });
  }
  function markVisited(state, qid) {
    requireOpen(state); requireQid(state, qid);
    const visited = Object.assign({}, state.visited); visited[qid] = true;
    return freshState(state, { visited: visited });
  }

  /* ---------- navigation (clamped, never mutates answers) ---------- */
  function goToQuestion(state, index, questionCount) {
    const count = questionCount != null ? questionCount : state.questionIds.length;
    const clamped = Math.max(0, Math.min(index, count - 1));
    return freshState(state, { currentQuestionIndex: clamped });
  }
  function goNext(state, questionCount) { return goToQuestion(state, state.currentQuestionIndex + 1, questionCount); }
  function goPrevious(state) { return goToQuestion(state, state.currentQuestionIndex - 1); }

  /* ---------- status ---------- */
  function getQuestionStatus(state, qid, currentIndex) {
    const idx = state.questionIds.indexOf(qid);
    if (idx === -1) throw new RangeError('unknown questionId: ' + qid);
    if (currentIndex != null && idx === currentIndex) return 'current';
    if (state.answers[qid] != null) return 'answered';
    if (state.visited[qid]) return 'visited-unanswered';
    return 'unvisited';
  }
  /* ---------- question resolution ---------- */
  function resolveQuestions(test, questions) {
    const byId = {};
    (questions || []).forEach(function (q) { byId[normalizeQId(q)] = q; });
    return test.questionIds.map(function (qid) {
      const q = byId[String(qid)];
      if (!q) fail('unresolved questionId ' + qid);
      return q;
    });
  }
  function findOption(q, optionId) {
    const want = normalizeOptionId({ id: optionId });
    return (q.options || []).find(function (o) { return normalizeOptionId(o) === want; }) || null;
  }
  function markingOf(test) {
    const m = test.marking || {};
    const correct = Number.isFinite(m.correct) ? m.correct : 1;
    const wrong = Number.isFinite(m.wrong) ? m.wrong : 0;
    if (wrong > 0) fail('marking.wrong must be <= 0');
    return { correct: correct, wrong: wrong };
  }

  /* ---------- scoring ---------- */
  function calculateResult(state, test, questions) {
    const resolved = resolveQuestions(test, questions);
    const m = markingOf(test);
    let correct = 0, incorrect = 0, unanswered = 0;
    resolved.forEach(function (q) {
      const sel = state.answers[normalizeQId(q)];
      if (sel == null) { unanswered++; return; }
      if (sel === normalizeOptionId({ id: q.correctAnswer })) correct++; else incorrect++;
    });
    const total = resolved.length;
    const attempted = correct + incorrect;
    const positiveMarks = correct * m.correct;
    const negativeMarks = incorrect * m.wrong;
    const score = positiveMarks + negativeMarks;
    const maxScore = total * m.correct;
    return {
      total: total, attempted: attempted, correct: correct, incorrect: incorrect,
      unanswered: unanswered, positiveMarks: positiveMarks, negativeMarks: negativeMarks,
      score: score, maxScore: maxScore,
      percentage: maxScore > 0 ? (score / maxScore) * 100 : 0,
      accuracy: attempted > 0 ? (correct / attempted) * 100 : 0
    };
  }

  /* ---------- review ---------- */
  function buildReview(state, test, questions) {
    return resolveQuestions(test, questions).map(function (q, i) {
      const sel = state.answers[normalizeQId(q)];
      const rightId = normalizeOptionId({ id: q.correctAnswer });
      const correctOpt = findOption(q, rightId);
      const selOpt = sel == null ? null : findOption(q, sel);
      return {
        questionId: normalizeQId(q), number: i + 1, question: q.question,
        selectedOption: selOpt ? { id: normalizeOptionId(selOpt), text: selOpt.text } : null,
        correctOption: correctOpt ? { id: normalizeOptionId(correctOpt), text: correctOpt.text } : null,
        resultStatus: sel == null ? 'unanswered' : (sel === rightId ? 'correct' : 'incorrect'),
        explanation: q.explanation || null, subject: q.subject || null, topic: q.topicId || q.topic || null
      };
    });
  }

  /* ---------- submission ---------- */
  function submitTest(state, test, questions, completedAt) {
    if (state.submitted) {
      return { state: state, result: calculateResult(state, test, questions), review: buildReview(state, test, questions) };
    }
    const finalState = freshState(state, { submitted: true, completedAt: completedAt != null ? completedAt : null });
    return { state: finalState, result: calculateResult(finalState, test, questions), review: buildReview(finalState, test, questions) };
  }

  /* ---------- timer helpers (deterministic; `now` injected) ---------- */
  function remainingSeconds(startedAt, durationSeconds, now) {
    return Math.max(0, Math.ceil((startedAt + durationSeconds * 1000 - now) / 1000));
  }
  function isExpired(startedAt, durationSeconds, now) {
    return now >= startedAt + durationSeconds * 1000;
  }

  /* ---------- exports ---------- */
  return {
    createInitialState: createInitialState,
    selectAnswer: selectAnswer,
    clearAnswer: clearAnswer,
    markVisited: markVisited,
    goNext: goNext,
    goPrevious: goPrevious,
    goToQuestion: goToQuestion,
    getQuestionStatus: getQuestionStatus,
    calculateResult: calculateResult,
    buildReview: buildReview,
    submitTest: submitTest,
    remainingSeconds: remainingSeconds,
    isExpired: isExpired
  };
});