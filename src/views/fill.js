/**
 * Part 1: Fill the Gap.
 * 5 sets per week, 5 random questions per set, 2 minutes per question.
 * A timed-out question counts as wrong. The timer keeps running if the page is closed.
 */
import { esc, HANDLES, toast, errText, arrowDoodle, shuffle, timerHtml, setTimer, flameBadge } from '../lib/ui.js';
import { now } from '../lib/clock.js';
import { dayDate, nextWeek } from '../lib/week.js';
import { SETS_PER_WEEK, QUESTIONS_PER_SET, QUESTION_MS, POINTS, setPoints, pickQuestions, liveStreak } from '../lib/rules.js';
import { saveWeek, addPoints, completePart, markCorrect, recordMistake, resetCorrect } from '../lib/session.js';

const KEYS = ['A', 'B', 'C', 'D'];

export function renderFill(app, ctx) {
  const { S } = ctx;
  const fill = S.week.fill;
  const done = fill.sets.length;
  const tiles = Array.from({ length: SETS_PER_WEEK }, (_, i) => {
    const set = fill.sets[i];
    if (set) {
      return `<div class="set-tile done"><span class="label">Set ${i + 1}</span><span class="score">${set.score}/${QUESTIONS_PER_SET}</span><span class="sticker ${set.score === QUESTIONS_PER_SET ? 'blue' : 'mint'}" style="--rot:2deg">+${set.points} pts</span></div>`;
    }
    if (i === done) {
      return `<div class="set-tile next"><span class="label">Set ${i + 1}</span><span class="hand">${fill.active ? 'in progress' : 'ready'}</span><a class="btn small" href="#/fill/play">${fill.active ? 'Resume' : 'Start'}</a></div>`;
    }
    return `<div class="set-tile"><span class="label">Set ${i + 1}</span><span class="muted" style="font-size:.85rem">Waiting</span></div>`;
  }).join('');

  app.innerHTML = `
  <div class="enter">
    <header class="page-head">
      <span class="label">Part one</span>
      <h1 class="pixel-title">Fill the Gap</h1>
      <span class="hand">two minutes a question</span>
      <p class="lead">Choose the word that completes each sentence correctly. You have <strong>2 minutes per question</strong>; if time runs out, the answer counts as wrong. Each correct answer earns ${POINTS.fillCorrect} points, and a perfect set earns a ${POINTS.fillPerfectBonus}-point bonus.</p>
      <div class="sticker-row">${flameBadge(liveStreak(S.profile.streaks.fill, S.weekKey), { label: 'Fill' })}<span class="sticker blue">+${S.week.points.fill} pts this week</span></div>
    </header>
    <section class="paper spiral">
      <div class="set-grid">${tiles}</div>
      <div class="btn-row" style="margin-top:26px">
        ${done >= SETS_PER_WEEK
          ? `<span class="sticker blue">✦ All five sets done</span><span class="muted">New sets open on ${dayDate(nextWeek(S.weekKey))}.</span>`
          : `<a class="btn" href="#/fill/play">${fill.active ? 'Resume set' : `Start set ${done + 1}`}</a>`}
        <a class="btn ghost" href="#/mistakes">My mistakes</a>
      </div>
      ${fill.active ? '' : '<p class="muted" style="margin-top:14px;font-size:.88rem">Once you press Start, the clock runs even if you leave the page, so start when you have about ten minutes.</p>'}
    </section>
  </div>`;
}

export async function renderFillPlay(app, ctx) {
  const { S, data } = ctx;
  const fill = S.week.fill;

  if (!fill.active) {
    if (fill.sets.length >= SETS_PER_WEEK) { ctx.go('#/fill'); return; }
    if (data.questions.length < QUESTIONS_PER_SET) {
      app.innerHTML = '<div class="paper notice"><p class="pixel-title">Not enough questions</p><p>Add more questions to public/data/grammar_questions.json.</p></div>';
      return;
    }
    const pick = pickQuestions(data.questions, S.priv.grammarCorrect);
    if (pick.reset) await resetCorrect();
    fill.active = { ids: pick.ids, index: 0, answers: [], opts: {}, qStartedAt: null };
    await saveWeek();
  }

  const active = fill.active;
  const byId = new Map(data.questions.map((q) => [q.id, q]));
  active.ids = active.ids.filter((id) => byId.has(id));
  if (active.index >= active.ids.length) return finishSet(app, ctx);

  const q = byId.get(active.ids[active.index]);
  if (!active.opts[q.id]) active.opts[q.id] = shuffle(q.options);
  if (!active.qStartedAt) {
    active.qStartedAt = now();
    await saveWeek();
  }
  const options = active.opts[q.id];
  const tilts = ['-1.5deg', '1deg', '0.8deg', '-0.8deg'];
  const parts = q.sentence.split('____');
  const sentenceHtml = parts.length > 1
    ? `${esc(parts[0])}<span class="blank" id="blank">&nbsp;?&nbsp;</span>${esc(parts.slice(1).join('____'))}`
    : esc(q.sentence);

  app.innerHTML = `
  <div class="question-page enter">
    <header class="page-head compact">
      <span class="label">Set ${S.week.fill.sets.length + 1} / Question ${active.index + 1} of ${active.ids.length}</span>
      <div class="sticker-row">
        <span class="sticker ${q.category === 'grammar' ? 'lilac' : 'mint'}">${q.category === 'grammar' ? 'Grammar' : 'Word choice'}</span>
        <span class="sticker peach" style="--rot:2deg">${esc(q.difficulty)}</span>
      </div>
    </header>
    <section class="paper spiral">
      <div class="q-top">
        <div class="dots" aria-hidden="true">${active.ids.map((_, i) => {
          if (i < active.answers.length) return `<span class="dot ${active.answers[i].correct ? 'on' : 'miss'}"></span>`;
          return '<span class="dot"></span>';
        }).join('')}</div>
        ${timerHtml('qtimer')}
      </div>
      <p class="q-sentence">${sentenceHtml}</p>
      <div class="options" role="group" aria-label="Answer options">
        ${options.map((opt, i) => `
          <button class="option" data-opt="${esc(opt)}" style="--rot:${tilts[i % 4]}">
            <span class="key">${KEYS[i]}</span>${esc(opt)}<span class="mark" aria-hidden="true"></span>
          </button>`).join('')}
      </div>
      <div id="feedback" aria-live="polite"></div>
    </section>
    <p class="on-cloth" style="margin-top:14px;font-size:.85rem">Tip: press A, B, C or D to answer.</p>
  </div>`;

  const buttons = Array.from(app.querySelectorAll('.option'));
  const timerEl = document.getElementById('qtimer');
  let answered = false;
  let interval = null;

  async function answer(btn) {
    if (answered) return;
    answered = true;
    clearInterval(interval);
    const timedOut = !btn;
    const choice = btn ? btn.dataset.opt : null;
    const correct = !timedOut && choice === q.answer;

    buttons.forEach((b) => {
      b.disabled = true;
      const isAnswer = b.dataset.opt === q.answer;
      if (isAnswer) { b.classList.add('correct'); b.querySelector('.mark').textContent = '✓'; }
      else if (b === btn) {
        b.classList.add('wrong', 'selbox');
        b.querySelector('.mark').textContent = '✕';
        b.insertAdjacentHTML('beforeend', HANDLES);
      } else b.classList.add('faded');
    });
    const blank = document.getElementById('blank');
    if (blank) { blank.textContent = q.answer; blank.classList.add(correct ? 'right' : 'wrong'); }
    if (timedOut) setTimer(timerEl, 0, QUESTION_MS);

    active.answers.push({ id: q.id, choice, correct, timedOut });
    active.index += 1;
    active.qStartedAt = null;

    const last = active.index >= active.ids.length;
    const fb = document.getElementById('feedback');
    fb.innerHTML = `
      <div class="explain lined ${correct ? 'good' : 'bad'}">
        <span class="hand ${correct ? '' : 'red'}">${timedOut ? `Time's up. The answer is "${esc(q.answer)}".` : correct ? `✓ Correct! +${POINTS.fillCorrect} pts` : `✕ Not quite. The answer is "${esc(q.answer)}".`}</span>
        <p style="margin:0">${esc(q.explanation)}</p>
      </div>
      <div class="btn-row" style="margin-top:22px">
        <button class="btn" id="next" disabled>Saving...</button>
        ${arrowDoodle()}
      </div>`;

    try {
      await saveWeek();
      if (correct) await markCorrect(q.id);
      else await recordMistake(q.id, choice);
    } catch (err) { toast(errText(err)); }

    const next = document.getElementById('next');
    if (next) {
      next.disabled = false;
      next.textContent = last ? 'See my score' : 'Next question';
      next.focus();
      next.addEventListener('click', () => ctx.rerender());
    }
  }

  function tick() {
    const left = QUESTION_MS - (now() - active.qStartedAt);
    setTimer(timerEl, left, QUESTION_MS);
    if (left <= 0) answer(null);
  }

  buttons.forEach((b) => b.addEventListener('click', () => answer(b)));
  const onKey = (e) => {
    if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const idx = KEYS.indexOf(String(e.key).toUpperCase());
    if (!answered && idx >= 0 && buttons[idx]) answer(buttons[idx]);
  };
  document.addEventListener('keydown', onKey);
  tick();
  interval = setInterval(tick, 250);

  return () => {
    clearInterval(interval);
    document.removeEventListener('keydown', onKey);
  };
}

async function finishSet(app, ctx) {
  const { S, data } = ctx;
  const fill = S.week.fill;
  const active = fill.active;
  const score = active.answers.filter((a) => a.correct).length;
  const pts = setPoints(score);
  fill.sets.push({ score, points: pts, finishedAt: now(), answers: active.answers });
  fill.active = null;
  await saveWeek();
  await addPoints('fill', pts);
  const allDone = fill.sets.length >= SETS_PER_WEEK;
  if (allDone) await completePart('fill');

  const byId = new Map(data.questions.map((q) => [q.id, q]));
  const wrong = active.answers.filter((a) => !a.correct);

  app.innerHTML = `
  <div class="question-page enter">
    <header class="page-head">
      <span class="label">Set ${fill.sets.length} complete</span>
      <div class="result-score">${score}/${active.answers.length}</div>
      <div class="sticker-row"><span class="sticker blue">+${pts} pts</span>${score === QUESTIONS_PER_SET ? `<span class="sticker peach" style="--rot:3deg">Perfect set bonus +${POINTS.fillPerfectBonus}</span>` : ''}</div>
      <span class="hand">${score === active.answers.length ? 'a perfect set' : score >= 3 ? 'good work, keep going' : 'every mistake is a lesson'}</span>
    </header>
    ${wrong.length ? `
    <section class="paper spiral stack">
      <span class="label">Review</span>
      ${wrong.map((a) => {
        const q = byId.get(a.id);
        if (!q) return '';
        return `<div class="explain lined bad" style="margin-top:0">
          <p class="serif" style="font-size:1.12rem;margin:0">${esc(q.sentence.replace('____', `[${q.answer}]`))}</p>
          <p style="margin:0"><strong>${a.timedOut ? 'Time ran out.' : `You chose: ${esc(a.choice)}.`}</strong> ${esc(q.explanation)}</p>
        </div>`;
      }).join('')}
    </section>` : ''}
    <div class="btn-row" style="margin-top:26px">
      ${allDone ? '<span class="sticker blue">✦ All five sets done. Your Fill the Gap streak is safe this week.</span>' : `<button class="btn" id="again">Start set ${fill.sets.length + 1}</button>`}
      <a class="btn ghost" href="#/fill">Back to sets</a>
    </div>
  </div>`;
  const again = document.getElementById('again');
  if (again) again.addEventListener('click', () => ctx.rerender());
  if (allDone) toast('Fill the Gap complete for this week.');
}
