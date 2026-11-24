/**
 * Part 1: Fill the Gap — now three sub-sections.
 * 1. Classic: pick the word that completes the sentence (the original game).
 * 2. Spot & Fix: find the grammar error, choose the corrected sentence.
 * 3. Build the Sentence: tap words in order to build the sentence.
 * Each sub-section is one set of 5 questions per week; 2 minutes per question.
 * A timed-out question counts as wrong. The timer keeps running if the page is closed.
 */
import { esc, HANDLES, toast, errText, arrowDoodle, shuffle, timerHtml, setTimer, flameBadge } from '../lib/ui.js';
import { now } from '../lib/clock.js';
import { dayDate, nextWeek } from '../lib/week.js';
import {
  FILL_PARTS, QUESTIONS_PER_SET, QUESTION_MS, POINTS, setPoints, pickQuestions, liveStreak
} from '../lib/rules.js';
import { saveWeek, addPoints, completePart, markCorrect, recordMistake, resetCorrect } from '../lib/session.js';

const KEYS = ['A', 'B', 'C', 'D'];

/** The question pool for a sub-section, keyed by its data file. */
const POOLS = {
  classic: (data) => data.questions,
  error: (data) => data.errorQuestions,
  build: (data) => data.builds
};

/** The correct-answer list for a sub-section (classic and error share the grammar mistakes list). */
const CORRECT_LISTS = {
  classic: (priv) => priv.grammarCorrect,
  error: (priv) => priv.grammarCorrect,
  build: (priv) => priv.buildCorrect || []
};

export function renderFill(app, ctx) {
  const { S } = ctx;
  const fill = S.week.fill;
  const streak = liveStreak(S.profile.streaks.fill, S.weekKey);

  const tiles = Object.values(FILL_PARTS).map((part) => {
    const state = fill[part.key];
    const set = state.sets[0];
    const done = Boolean(set);
    const inProgress = Boolean(state.active);
    return `
    <div class="set-tile ${done ? 'done' : inProgress ? 'next' : ''}">
      <span class="label">${part.name}</span>
      <span class="muted" style="font-size:.85rem;margin:6px 0;display:block">${part.desc}</span>
      ${done
        ? `<span class="score">${set.score}/${QUESTIONS_PER_SET}</span><span class="sticker ${set.score === QUESTIONS_PER_SET ? 'blue' : 'mint'}" style="--rot:2deg">+${set.points} pts</span>`
        : `<span class="hand">${inProgress ? 'in progress' : 'waiting'}</span><a class="btn small" href="#/fill/play/${part.key}">${inProgress ? 'Resume' : 'Start'}</a>`}
    </div>`;
  }).join('');

  const allDone = Object.values(FILL_PARTS).every((p) => fill[p.key].sets.length > 0);

  app.innerHTML = `
  <div class="enter">
    <header class="page-head">
      <span class="label">Part one</span>
      <h1 class="pixel-title">Fill the Gap</h1>
      <span class="hand">three ways to sharpen your grammar</span>
      <p class="lead">Three short sets a week, five questions each, <strong>2 minutes per question</strong>. Keep the classic gap game, then hunt down an error, then build a sentence from scratch. Each correct answer earns ${POINTS.fillCorrect} points, and a perfect set earns a ${POINTS.fillPerfectBonus}-point bonus.</p>
      <div class="sticker-row">${flameBadge(streak, { label: 'Fill' })}<span class="sticker blue">+${S.week.points.fill} pts this week</span></div>
    </header>
    <section class="paper spiral">
      <div class="set-grid">${tiles}</div>
      <div class="btn-row" style="margin-top:26px">
        ${allDone
          ? `<span class="sticker blue">✦ All three sets done</span><span class="muted">New sets open on ${dayDate(nextWeek(S.weekKey))}.</span>`
          : `<span class="muted">Finish all three sets to keep your Fill streak alive.</span>`}
        <a class="btn ghost" href="#/mistakes">My mistakes</a>
      </div>
    </section>
  </div>`;
}

export async function renderFillPlay(app, ctx, partKey) {
  const { S, data } = ctx;
  const part = FILL_PARTS[partKey];
  if (!part) { ctx.go('#/fill'); return; }
  const state = S.week.fill[partKey];

  if (!state.active) {
    if (state.sets.length) { ctx.go('#/fill'); return; }
    const pool = POOLS[partKey](data);
    if (!pool || pool.length < QUESTIONS_PER_SET) {
      app.innerHTML = `<div class="paper notice"><p class="pixel-title">Not enough questions</p><p>Add more entries to the ${partKey} question file in public/data/.</p></div>`;
      return;
    }
    const correctIds = CORRECT_LISTS[partKey](S.priv);
    const pick = pickQuestions(pool, correctIds);
    if (pick.reset && partKey === 'classic') await resetCorrect();
    state.active = { ids: pick.ids, index: 0, answers: [], opts: {}, qStartedAt: null };
    await saveWeek();
  }

  const active = state.active;
  const pool = POOLS[partKey](data);
  const byId = new Map(pool.map((q) => [q.id, q]));
  active.ids = active.ids.filter((id) => byId.has(id));
  if (active.index >= active.ids.length) return finishSet(app, ctx, partKey);

  const q = byId.get(active.ids[active.index]);
  if (partKey === 'build') return renderBuildQuestion(app, ctx, partKey, q);
  return renderChoiceQuestion(app, ctx, partKey, q);
}

/* ---------------------------------------------------------- Choice question (classic + error) */
async function renderChoiceQuestion(app, ctx, partKey, q) {
  const { S } = ctx;
  const state = S.week.fill[partKey];
  const active = state.active;
  if (!active.opts[q.id]) active.opts[q.id] = shuffle(q.options);
  if (!active.qStartedAt) {
    active.qStartedAt = now();
    await saveWeek();
  }
  const options = active.opts[q.id];
  const tilts = ['-1.5deg', '1deg', '0.8deg', '-0.8deg'];

  const isSentenceOptions = partKey === 'error';
  const sticker = partKey === 'classic'
    ? (q.category === 'grammar' ? `<span class="sticker ${q.category === 'grammar' ? 'lilac' : 'mint'}">${q.category === 'grammar' ? 'Grammar' : 'Word choice'}</span>` : '')
    : `<span class="sticker lilac">Spot & Fix</span><span class="sticker peach" style="--rot:2deg">${esc(q.category || 'grammar')}</span>`;

  app.innerHTML = `
  <div class="question-page enter">
    <header class="page-head compact">
      <span class="label">${FILL_PARTS[partKey].name} / Question ${active.index + 1} of ${active.ids.length}</span>
      <div class="sticker-row">${sticker}<span class="sticker peach" style="--rot:-1deg">${esc(q.difficulty || '')}</span></div>
    </header>
    <section class="paper spiral">
      <div class="q-top">
        <div class="dots" aria-hidden="true">${active.ids.map((_, i) => {
          if (i < active.answers.length) return `<span class="dot ${active.answers[i].correct ? 'on' : 'miss'}"></span>`;
          return '<span class="dot"></span>';
        }).join('')}</div>
        ${timerHtml('qtimer')}
      </div>
      ${isSentenceOptions
        ? `<p class="q-sentence wrong-sentence">${esc(q.sentence)}</p>
           <p class="hand" style="text-align:center;margin:4px 0 14px">↓ pick the corrected version</p>`
        : `<p class="q-sentence">${esc(q.sentence).replace(/____/g, '<span class="blank" id="blank">&nbsp;?&nbsp;</span>')}</p>`}
      <div class="options ${isSentenceOptions ? 'sentence-options' : ''}" role="group" aria-label="Answer options">
        ${options.map((opt, i) => `
          <button class="option" data-opt="${esc(opt)}" style="--rot:${tilts[i % 4]}">
            <span class="key">${KEYS[i]}</span><span class="opt-text">${esc(opt)}</span><span class="mark" aria-hidden="true"></span>
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
    const verdict = timedOut ? `Time's up. The right answer is shown in green.`
      : correct ? `✓ Correct! +${POINTS.fillCorrect} pts`
      : `✕ Not quite. The green option is right${q.error ? ` — the error was: ${q.error}` : ''}.`;
    fb.innerHTML = `
      <div class="explain lined ${correct ? 'good' : 'bad'}">
        <span class="hand ${correct ? '' : 'red'}">${verdict}</span>
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

/* ---------------------------------------------------------- Build question (tap words in order) */
async function renderBuildQuestion(app, ctx, partKey, q) {
  const { S } = ctx;
  const state = S.week.fill[partKey];
  const active = state.active;
  if (!active.opts[q.id]) {
    // Scrambled word tiles, guaranteed different from the answer order.
    let scrambled = shuffle(q.words);
    let tries = 0;
    while (scrambled.join('\u0001') === q.words.join('\u0001') && tries++ < 9) scrambled = shuffle(q.words);
    active.opts[q.id] = scrambled;
  }
  if (!active.qStartedAt) {
    active.qStartedAt = now();
    await saveWeek();
  }
  const tiles = active.opts[q.id];

  app.innerHTML = `
  <div class="question-page enter">
    <header class="page-head compact">
      <span class="label">Build the Sentence / Question ${active.index + 1} of ${active.ids.length}</span>
      <div class="sticker-row"><span class="sticker mint">Build</span><span class="sticker peach" style="--rot:2deg">${esc(q.difficulty || '')}</span></div>
    </header>
    <section class="paper spiral">
      <div class="q-top">
        <div class="dots" aria-hidden="true">${active.ids.map((_, i) => {
          if (i < active.answers.length) return `<span class="dot ${active.answers[i].correct ? 'on' : 'miss'}"></span>`;
          return '<span class="dot"></span>';
        }).join('')}</div>
        ${timerHtml('qtimer')}
      </div>
      <p class="build-goal"><span class="label">Goal</span> ${esc(q.instruction)}</p>
      <div class="build-line lined" id="build-line" aria-label="Your sentence"></div>
      <div class="btn-row" style="margin:14px 0">
        <button class="btn ghost small" id="undo">Undo word</button>
        <button class="btn ghost small" id="clear">Clear</button>
        <button class="btn" id="check" disabled>Check answer</button>
      </div>
      <div class="build-bank" id="bank" role="group" aria-label="Word tiles">
        ${tiles.map((w, i) => `<button class="word-tile" data-i="${i}">${esc(w)}</button>`).join('')}
      </div>
      <div id="feedback" aria-live="polite"></div>
    </section>
  </div>`;

  const bank = document.getElementById('bank');
  const line = document.getElementById('build-line');
  const check = document.getElementById('check');
  const timerEl = document.getElementById('qtimer');
  const picked = []; // indexes into tiles
  let done = false;
  let interval = null;

  const sync = () => {
    line.innerHTML = picked.length
      ? picked.map((i) => `<span class="word-chip">${esc(tiles[i])}</span>`).join(' ')
      : '<span class="muted" style="font-style:italic">tap the words below in order...</span>';
    check.disabled = picked.length !== tiles.length || done;
    document.getElementById('undo').disabled = !picked.length || done;
    document.getElementById('clear').disabled = !picked.length || done;
    bank.querySelectorAll('.word-tile').forEach((b) => {
      b.disabled = picked.includes(Number(b.dataset.i)) || done;
    });
  };

  bank.addEventListener('click', (e) => {
    const b = e.target.closest('.word-tile');
    if (!b || done) return;
    picked.push(Number(b.dataset.i));
    sync();
  });
  document.getElementById('undo').addEventListener('click', () => { if (!done) { picked.pop(); sync(); } });
  document.getElementById('clear').addEventListener('click', () => { if (!done) { picked.length = 0; sync(); } });

  async function grade(timedOut = false) {
    if (done) return;
    done = true;
    clearInterval(interval);
    const attempt = timedOut ? [] : picked.map((i) => tiles[i]);
    const correct = !timedOut && attempt.join(' ') === q.answer;

    const correctChips = q.answer.split(' ').map((w) => `<span class="word-chip ok">${esc(w)}</span>`).join(' ');
    line.innerHTML = timedOut || !correct
      ? `${attempt.length ? attempt.map((w) => `<span class="word-chip bad">${esc(w)}</span>`).join(' ') + '<br>' : ''}${correctChips}`
      : correctChips;
    if (timedOut) setTimer(timerEl, 0, QUESTION_MS);
    sync();

    active.answers.push({ id: q.id, choice: attempt.join(' '), correct, timedOut });
    active.index += 1;
    active.qStartedAt = null;

    const last = active.index >= active.ids.length;
    const fb = document.getElementById('feedback');
    fb.innerHTML = `
      <div class="explain lined ${correct ? 'good' : 'bad'}">
        <span class="hand ${correct ? '' : 'red'}">${timedOut ? `Time's up — the answer is shown above.` : correct ? `✓ Perfect build! +${POINTS.fillCorrect} pts` : '✕ Not the right order. The correct sentence is shown above.'}</span>
        <p style="margin:0">${esc(q.explanation)}</p>
      </div>
      <div class="btn-row" style="margin-top:22px">
        <button class="btn" id="next" disabled>Saving...</button>
        ${arrowDoodle()}
      </div>`;

    try {
      await saveWeek();
      if (correct) await markCorrect(q.id);
      else await recordMistake(q.id, attempt.join(' '));
    } catch (err) { toast(errText(err)); }

    const next = document.getElementById('next');
    if (next) {
      next.disabled = false;
      next.textContent = last ? 'See my score' : 'Next question';
      next.focus();
      next.addEventListener('click', () => ctx.rerender());
    }
  }

  check.addEventListener('click', () => grade(false));

  function tick() {
    const left = QUESTION_MS - (now() - active.qStartedAt);
    setTimer(timerEl, left, QUESTION_MS);
    if (left <= 0) grade(true);
  }
  tick();
  interval = setInterval(tick, 250);
  sync();

  return () => clearInterval(interval);
}

/* ---------------------------------------------------------- Finish */
async function finishSet(app, ctx, partKey) {
  const { S, data } = ctx;
  const part = FILL_PARTS[partKey];
  const state = S.week.fill[partKey];
  const active = state.active;
  const score = active.answers.filter((a) => a.correct).length;
  const pts = setPoints(score);
  state.sets.push({ score, points: pts, finishedAt: now(), answers: active.answers });
  state.active = null;
  await saveWeek();
  await addPoints('fill', pts);

  const allDone = Object.values(FILL_PARTS).every((p) => S.week.fill[p.key].sets.length > 0);
  if (allDone) await completePart('fill');

  const pool = POOLS[partKey](data);
  const byId = new Map(pool.map((q) => [q.id, q]));
  const wrong = active.answers.filter((a) => !a.correct);

  const nextPart = Object.values(FILL_PARTS).find((p) => !S.week.fill[p.key].sets.length && !S.week.fill[p.key].active);

  app.innerHTML = `
  <div class="question-page enter">
    <header class="page-head">
      <span class="label">${part.name} complete</span>
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
        const shown = partKey === 'build'
          ? `Correct: ${q.answer}`
          : partKey === 'error'
            ? esc(q.answer)
            : esc(q.sentence.replace('____', `[${q.answer}]`));
        return `<div class="explain lined bad" style="margin-top:0">
          <p class="serif" style="font-size:1.05rem;margin:0">${partKey === 'classic' ? shown : esc(q.sentence)}</p>
          ${partKey !== 'classic' ? `<p class="serif" style="font-size:1.05rem;margin:4px 0">✓ ${shown}</p>` : ''}
          <p style="margin:0"><strong>${a.timedOut ? 'Time ran out.' : `You chose: ${esc(a.choice || '—')}.`}</strong> ${esc(q.explanation)}</p>
        </div>`;
      }).join('')}
    </section>` : ''}
    <div class="btn-row" style="margin-top:26px">
      ${nextPart
        ? `<a class="btn" href="#/fill/play/${nextPart.key}">Next: ${nextPart.name}</a>`
        : '<span class="sticker blue">✦ All three sets done. Your Fill the Gap streak is safe this week.</span>'}
      <a class="btn ghost" href="#/fill">Back to sets</a>
    </div>
  </div>`;
  if (!nextPart) toast('Fill the Gap complete for this week.');
}
