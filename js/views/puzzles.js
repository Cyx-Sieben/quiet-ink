/**
 * Part 1: Word puzzles (teka-teki).
 * Five sets per week, five random questions per set.
 */

import { esc, HANDLES, toast, arrowDoodle, shuffle } from '../ui.js';
import { SETS_PER_WEEK, QUESTIONS_PER_SET, pickQuestions } from '../progress.js';
import { dayDate, addDays } from '../week.js';

const KEYS = ['A', 'B', 'C', 'D'];

/** Overview page: the five set tiles for this week. */
export function renderPuzzles(app, ctx) {
  const { rec, key } = ctx;
  const done = rec.sets.length;
  const tiles = Array.from({ length: SETS_PER_WEEK }, (_, i) => {
    const set = rec.sets[i];
    if (set) {
      return `<div class="set-tile done"><span class="label">Set ${i + 1}</span><span class="score">${set.score}/${QUESTIONS_PER_SET}</span><span class="sticker ${set.score === QUESTIONS_PER_SET ? 'blue' : 'mint'}" style="--rot:2deg">${set.score === QUESTIONS_PER_SET ? 'Perfect' : 'Done'}</span></div>`;
    }
    if (i === done) {
      return `<div class="set-tile next"><span class="label">Set ${i + 1}</span><span class="hand">${rec.active ? 'in progress' : 'ready'}</span><a class="btn small" href="#/puzzles/play">${rec.active ? 'Resume' : 'Start'}</a></div>`;
    }
    return `<div class="set-tile"><span class="label">Set ${i + 1}</span><span class="muted" style="font-size:.85rem">Waiting</span></div>`;
  }).join('');

  const total = rec.sets.reduce((sum, s) => sum + s.score, 0);

  app.innerHTML = `
  <div class="enter">
    <header class="page-head">
      <span class="label">Part one / Word puzzles</span>
      <h1 class="pixel-title">Teka-Teki</h1>
      <span class="hand">five sets, any time this week</span>
      <p class="lead">Each question is a sentence with one blank. Choose the word that makes it correct, then read why. Questions you answer correctly will not return until you have seen the whole bank.</p>
    </header>

    <section class="paper spiral">
      <div class="set-grid">${tiles}</div>
      <div class="btn-row" style="margin-top:26px">
        ${done >= SETS_PER_WEEK
          ? `<span class="sticker blue">✦ All five sets done: ${total}/${SETS_PER_WEEK * QUESTIONS_PER_SET}</span><span class="muted">New sets open on ${dayDate(addDays(key, 7))}.</span>`
          : `<a class="btn" href="#/puzzles/play">${rec.active ? 'Resume set' : `Start set ${done + 1}`}</a>`}
        <a class="btn ghost" href="#/mistakes">Review my mistakes</a>
      </div>
    </section>
  </div>`;
}

/** One question at a time. */
export function renderPuzzlePlay(app, ctx) {
  const { rec, data, state } = ctx;

  if (!rec.active) {
    if (rec.sets.length >= SETS_PER_WEEK) {
      ctx.go('#/puzzles');
      return;
    }
    if (data.questions.length < QUESTIONS_PER_SET) {
      app.innerHTML = `<div class="paper notice"><p class="pixel-title">Not enough questions</p><p>Add at least ${QUESTIONS_PER_SET} questions to data/grammar_questions.json.</p></div>`;
      return;
    }
    rec.active = { ids: pickQuestions(ctx), index: 0, answers: [] };
    ctx.save();
  }

  const active = rec.active;
  const byId = new Map(data.questions.map((q) => [q.id, q]));
  // If a question was removed from the data file mid-set, drop it.
  active.ids = active.ids.filter((id) => byId.has(id));

  if (active.index >= active.ids.length) {
    finishSet(app, ctx);
    return;
  }

  const q = byId.get(active.ids[active.index]);
  const setNo = rec.sets.length + 1;
  // Shuffle option order once per question and remember it, so a refresh shows the same order.
  if (!active.opts) active.opts = {};
  if (!active.opts[q.id]) { active.opts[q.id] = shuffle(q.options); ctx.save(); }
  const options = active.opts[q.id];
  const tilts = ['-1.5deg', '1deg', '0.8deg', '-0.8deg'];

  const parts = q.sentence.split('____');
  const sentenceHtml = parts.length > 1
    ? `${esc(parts[0])}<span class="blank" id="blank">&nbsp;?&nbsp;</span>${esc(parts.slice(1).join('____'))}`
    : esc(q.sentence);

  app.innerHTML = `
  <div class="question-page enter">
    <header class="page-head">
      <span class="label">Set ${setNo} / Question ${active.index + 1} of ${active.ids.length}</span>
      <div class="sticker-row">
        <span class="sticker ${q.category === 'grammar' ? 'lilac' : 'mint'}">${q.category === 'grammar' ? 'Grammar' : 'Word choice'}</span>
        <span class="sticker peach" style="--rot:2deg">${esc(q.difficulty)}</span>
      </div>
    </header>

    <section class="paper spiral">
      <div class="dots" aria-hidden="true">${active.ids.map((_, i) => {
        if (i < active.answers.length) return `<span class="dot ${active.answers[i].correct ? 'on' : 'miss'}"></span>`;
        return '<span class="dot"></span>';
      }).join('')}</div>
      <p class="q-sentence">${sentenceHtml}</p>
      <div class="options" role="group" aria-label="Answer options">
        ${options.map((opt, i) => `
          <button class="option" data-opt="${esc(opt)}" style="--rot:${tilts[i % 4]}">
            <span class="key">${KEYS[i]}</span>${esc(opt)}
          </button>`).join('')}
      </div>
      <div id="feedback" aria-live="polite"></div>
    </section>
    <p class="on-cloth" style="margin-top:14px;font-size:.85rem">Tip: press A, B, C or D to answer, and Enter to continue.</p>
  </div>`;

  const buttons = Array.from(app.querySelectorAll('.option'));
  let answered = false;

  function choose(btn) {
    if (answered) return;
    answered = true;
    const choice = btn.dataset.opt;
    const correct = choice === q.answer;

    buttons.forEach((b) => {
      b.disabled = true;
      if (b.dataset.opt === q.answer) b.classList.add('correct');
      else if (b === btn) { b.classList.add('wrong', 'selbox'); b.insertAdjacentHTML('beforeend', HANDLES); }
      else b.classList.add('faded');
    });

    const blank = document.getElementById('blank');
    if (blank) {
      blank.textContent = q.answer;
      if (!correct) blank.classList.add('wrong');
    }

    // Record the answer
    active.answers.push({ id: q.id, choice, correct });
    if (correct) {
      if (!state.grammar.correct.includes(q.id)) state.grammar.correct.push(q.id);
    } else {
      const m = state.grammar.mistakes[q.id] || { count: 0, last: null, choice: null };
      m.count += 1;
      m.last = new Date().toISOString();
      m.choice = choice;
      state.grammar.mistakes[q.id] = m;
    }
    active.index += 1;
    ctx.save();

    const last = active.index >= active.ids.length;
    document.getElementById('feedback').innerHTML = `
      <div class="explain lined">
        <span class="hand ${correct ? '' : 'red'}">${correct ? 'Nicely chosen.' : `Not quite. The answer is "${esc(q.answer)}".`}</span>
        <p style="margin:0">${esc(q.explanation)}</p>
      </div>
      <div class="btn-row" style="margin-top:22px">
        <button class="btn" id="next">${last ? 'See my score' : 'Next question'}</button>
        ${arrowDoodle()}
      </div>`;
    document.getElementById('next').focus();
    document.getElementById('next').addEventListener('click', () => ctx.rerender());
  }

  buttons.forEach((b) => b.addEventListener('click', () => choose(b)));

  const onKey = (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const idx = KEYS.indexOf(e.key.toUpperCase());
    if (!answered && idx >= 0 && buttons[idx]) choose(buttons[idx]);
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}

function finishSet(app, ctx) {
  const { rec, data } = ctx;
  const active = rec.active;
  const score = active.answers.filter((a) => a.correct).length;
  rec.sets.push({ finishedAt: new Date().toISOString(), score, ids: active.ids, answers: active.answers });
  rec.active = null;
  ctx.save();

  const byId = new Map(data.questions.map((q) => [q.id, q]));
  const wrong = active.answers.filter((a) => !a.correct);
  const left = SETS_PER_WEEK - rec.sets.length;

  app.innerHTML = `
  <div class="question-page enter">
    <header class="page-head">
      <span class="label">Set ${rec.sets.length} complete</span>
      <div class="result-score">${score}/${active.answers.length}</div>
      <span class="hand">${score === active.answers.length ? 'a perfect set' : score >= 3 ? 'good work, keep going' : 'every mistake is a lesson'}</span>
    </header>

    ${wrong.length ? `
    <section class="paper spiral stack">
      <span class="label">Review your mistakes</span>
      ${wrong.map((a) => {
        const q = byId.get(a.id);
        if (!q) return '';
        return `<div class="explain lined" style="margin-top:0">
          <p class="serif" style="font-size:1.12rem;margin:0">${esc(q.sentence.replace('____', `[${q.answer}]`))}</p>
          <p style="margin:0"><strong>You chose:</strong> ${esc(a.choice)}. ${esc(q.explanation)}</p>
        </div>`;
      }).join('')}
    </section>` : ''}

    <div class="btn-row" style="margin-top:26px">
      ${left > 0 ? `<button class="btn" id="again">Start set ${rec.sets.length + 1}</button>` : '<span class="sticker blue">✦ All five sets done this week</span>'}
      <a class="btn ghost" href="#/puzzles">Back to sets</a>
    </div>
  </div>`;

  const again = document.getElementById('again');
  if (again) again.addEventListener('click', () => ctx.rerender());
  if (left === 0) toast('All five puzzle sets complete for this week.');
}
