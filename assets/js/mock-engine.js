/* MarathiAura Mock Test Engine (client-side, no dependencies) */
(function () {
  'use strict';
  var T = window.TEST_DATA;
  if (!T) return;
  var state = { i: 0, answers: {}, submitted: false, remaining: T.durationMinutes * 60, timerId: null };

  var el = {
    quiz: document.getElementById('quiz'),
    timer: document.getElementById('timer'),
    prev: document.getElementById('btn-prev'),
    next: document.getElementById('btn-next'),
    submit: document.getElementById('btn-submit'),
    result: document.getElementById('result')
  };
  if (!el.quiz) return;

  function esc(s) { var d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }

  function fmt(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function startTimer() {
    state.timerId = setInterval(function () {
      state.remaining--;
      if (el.timer) el.timer.textContent = '⏱ ' + fmt(Math.max(state.remaining, 0));
      if (state.remaining <= 0) { clearInterval(state.timerId); submit(true); }
    }, 1000);
  }

  function render() {
    var q = T.questions[state.i];
    var picked = state.answers[q.qid];
    var html = '<div class="quiz-q" data-qid="' + esc(q.qid) + '">';
    html += '<div class="q-no">प्रश्न ' + (state.i + 1) + ' / ' + T.questions.length + ' · ' + esc(q.subject || '') + '</div>';
    html += '<div class="q-text">' + esc(q.question) + '</div>';
    ['A', 'B', 'C', 'D'].forEach(function (k) {
      if (q.options[k] == null) return;
      var checked = picked === k ? ' checked' : '';
      var cls = 'opt';
      if (state.submitted) {
        if (k === q.correctAnswer) cls += ' correct';
        else if (picked === k) cls += ' wrong';
      }
      html += '<label class="' + cls + '"><input type="radio" name="q_' + esc(q.qid) + '" value="' + k + '"' +
        (state.submitted ? ' disabled' : '') + checked + '> <strong>' + k + '.</strong> ' + esc(q.options[k]) + '</label>';
    });
    if (state.submitted) {
      html += '<div class="explanation"><strong>स्पष्टीकरण:</strong> ' + esc(q.explanation) +
        (q.source ? '<br><small>स्रोत: ' + esc(q.source) + '</small>' : '') + '</div>';
    }
    html += '</div>';
    el.quiz.innerHTML = html;
    el.prev.disabled = state.i === 0;
    el.next.disabled = state.i === T.questions.length - 1;
    el.submit.style.display = state.submitted ? 'none' : '';
  }

  function bindAnswers() {
    el.quiz.addEventListener('change', function (e) {
      if (state.submitted) return;
      var qid = e.target.name.replace(/^q_/, '');
      state.answers[qid] = e.target.value;
    });
  }

  function submit(auto) {
    if (state.submitted) return;
    state.submitted = true;
    clearInterval(state.timerId);
    var total = T.questions.length;
    var correct = 0, wrong = 0, unattempted = 0;
    T.questions.forEach(function (q) {
      var a = state.answers[q.qid];
      if (!a) unattempted++;
      else if (a === q.correctAnswer) correct++;
      else wrong++;
    });
    var pct = total ? Math.round((correct / total) * 100) : 0;
    var acc = (correct + wrong) ? Math.round((correct / (correct + wrong)) * 100) : 0;
    el.result.style.display = '';
    el.result.innerHTML =
      '<h2>' + (auto ? 'वेळ संपली! टेस्ट स्वयंचलित सबमिट झाला.' : 'टेस्ट पूर्ण झाला!') + '</h2>' +
      '<div class="score-grid">' +
      '<div class="score-box"><div class="num">' + correct + '/' + total + '</div><div class="lbl">बरोबर</div></div>' +
      '<div class="score-box"><div class="num">' + wrong + '</div><div class="lbl">चुकीचे</div></div>' +
      '<div class="score-box"><div class="num">' + unattempted + '</div><div class="lbl">न विचारलेले</div></div>' +
      '<div class="score-box"><div class="num">' + pct + '%</div><div class="lbl">टक्केवारी</div></div>' +
      '<div class="score-box"><div class="num">' + acc + '%</div><div class="lbl">अचूकता (Accuracy)</div></div>' +
      '</div><p style="margin-bottom:0"><small>खाली सर्व प्रश्नांची उत्तरे व स्पष्टीकरण पाहा.</small></p>';
    el.submit.style.display = 'none';
    render();
    el.result.scrollIntoView({ behavior: 'smooth' });
  }
  el.prev.addEventListener('click', function () { if (state.i > 0) { state.i--; render(); window.scrollTo(0, 0); } });
  el.next.addEventListener('click', function () { if (state.i < T.questions.length - 1) { state.i++; render(); window.scrollTo(0, 0); } });
  el.submit.addEventListener('click', function () { submit(false); });
  document.addEventListener('keydown', function (e) {
    if (state.submitted) return;
    if (e.key === 'ArrowRight' && state.i < T.questions.length - 1) { state.i++; render(); }
    if (e.key === 'ArrowLeft' && state.i > 0) { state.i--; render(); }
  });

  bindAnswers();
  render();
  if (el.timer) el.timer.textContent = '⏱ ' + fmt(state.remaining);
  startTimer();
})();
