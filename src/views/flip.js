/**
 * Part 2: Word Flip.
 * One topic of 10 cards per week. Press Start for a 5-minute quiz: pick the meaning
 * from 3 options, then the card flips to teach it. One answer per card, no retries.
 */
import { esc, toast, errText, binderClip, timerHtml, setTimer, flameBadge } from '../lib/ui.js';
import { now } from '../lib/clock.js';
import { dayDate, nextWeek } from '../lib/week.js';
import { FLIP_MS, POINTS, flipPoints, flipOptions, liveStreak } from '../lib/rules.js';
import { saveWeek, addPoints, completePart, addToList, recordCardResult } from '../lib/session.js';

function head(S, topic, index, total) {
  return `
  <header class="page-head">
    <span class="label">Part two / Topic ${index + 1} of ${total}</span>
    <h1 class="pixel-title">${topic ? esc(topic.title) : 'Word Flip'}</h1>
    <span class="hand">this week's ten</span>
    ${topic ? `<p class="lead">${esc(topic.description)}</p>` : ''}
    <div class="sticker-row">${flameBadge(liveStreak(S.profile.streaks.flip, S.weekKey), { label: 'Flip' })}<span class="sticker blue">+${S.week.points.flip} pts this week</span></div>
  </header>`;
}

export function renderFlip(app, ctx) {
  const { S, data } = ctx;
  const flip = S.week.flip;
  const tIndex = flip ? flip.topic : S.priv.flipCompleted.length;
  const topic = data.topics[tIndex];

  if (!topic) {
    app.innerHTML = `<div class="paper notice enter"><p class="pixel-title">Every topic finished</p><p>You have completed all ${data.topics.length} topics. Review them in <a href="#/topics">past topics</a>.</p></div>`;
    return;
  }
  if (!topic.cards || !topic.cards.length) {
    app.innerHTML = `<div class="enter">${head(S, topic, tIndex, data.topics.length)}<div class="paper notice"><span class="hand red">cards coming soon</span><p style="margin-top:10px">This topic has no cards yet. Add ten cards for "${esc(topic.title)}" in public/data/flashcard_topics.json.</p></div></div>`;
    return;
  }

  if (flip && flip.done) {
    const next = data.topics[S.priv.flipCompleted.length];
    app.innerHTML = `
    <div class="enter">
      ${head(S, topic, tIndex, data.topics.length)}
      <section class="paper spiral" style="text-align:center">
        <div class="result-score">${flip.score}/${flip.total}</div>
        <div class="sticker-row" style="justify-content:center;margin:10px 0 4px"><span class="sticker blue">+${flip.points} pts</span>${flip.timedOut ? '<span class="sticker red">Time ran out</span>' : ''}</div>
        <p class="lead" style="margin:14px auto;max-width:560px">You can study all ten cards in <em>${esc(topic.title)}</em> at any time, without a timer.</p>
        <div class="sealed">
          <span class="label">Next topic</span>
          <p class="pixel-title" style="font-size:1.8rem;margin:8px 0">${next ? esc(next.title) : 'All done'}</p>
          <span class="hand red">opens ${esc(dayDate(nextWeek(S.weekKey)))}</span>
          <div class="seal-tape">LOCKED</div>
          <div class="seal-tape two">LOCKED</div>
        </div>
        <div class="btn-row" style="justify-content:center;margin-top:28px">
          <a class="btn" href="#/topics/${tIndex}">Study these cards</a>
          <a class="btn ghost" href="#/topics">Past topics</a>
        </div>
      </section>
    </div>`;
    return;
  }

  app.innerHTML = `
  <div class="enter">
    ${head(S, topic, tIndex, data.topics.length)}
    <section class="paper spiral" style="text-align:center">
      <span class="label">How it works</span>
      <ol class="rules-list">
        <li>Each card shows a word or phrase with <strong>three possible meanings</strong>.</li>
        <li>Choose one. Green means correct; red means wrong. Then the card flips to show the meaning and example sentences.</li>
        <li>You get <strong>one answer per card</strong>, and <strong>5 minutes</strong> for all ten. Unanswered cards count as wrong.</li>
        <li>${POINTS.flipCorrect} points per correct card, plus a ${POINTS.flipPerfectBonus}-point bonus for 10 out of 10.</li>
      </ol>
      <a class="btn" href="#/flip/play">${flip ? 'Resume quiz' : 'Start the 5-minute quiz'}</a>
      ${flip ? '<p class="muted" style="margin-top:12px">Your quiz is already running.</p>' : ''}
    </section>
  </div>`;
}

export async function renderFlipPlay(app, ctx) {
  const { S, data } = ctx;
  if (!S.week.flip) {
    const tIndex = S.priv.flipCompleted.length;
    const topic = data.topics[tIndex];
    if (!topic || !topic.cards || !topic.cards.length) { ctx.go('#/flip'); return; }
    const options = {};
    topic.cards.forEach((_, i) => { options[i] = flipOptions(topic.cards, i); });
    S.week.flip = { topic: tIndex, startedAt: now(), options, answers: {}, current: 0, done: false, score: 0, total: topic.cards.length, points: 0, timedOut: false };
    await saveWeek();
  }
  const flip = S.week.flip;
  if (flip.done) { ctx.go('#/flip'); return; }

  const topic = data.topics[flip.topic];
  const cards = topic.cards;
  const deadline = flip.startedAt + FLIP_MS;
  if (now() >= deadline || flip.current >= cards.length) return finishFlip(app, ctx, now() >= deadline);

  const i = flip.current;
  const card = cards[i];
  const opts = flip.options[i] || flipOptions(cards, i);
  const prior = flip.answers[i];

  app.innerHTML = `
  <div class="enter">
    <header class="page-head compact">
      <span class="label">Word Flip / ${esc(topic.title)} / Card ${i + 1} of ${cards.length}</span>
      <div class="q-top">
        <div class="dots" aria-hidden="true">${cards.map((_, j) => {
          const a = flip.answers[j];
          return `<span class="dot ${a ? (a.correct ? 'on' : 'miss') : ''}"></span>`;
        }).join('')}</div>
        ${timerHtml('ftimer')}
      </div>
    </header>
    <section class="board">
      <div class="clip-top">${binderClip()}</div>
      <div class="flash-stage">
        <div class="lanyard" id="lanyard">
          <div class="strap"></div>
          <div class="badge-clip"></div>
          <div class="fcard ${prior ? 'flipped' : ''}" id="fcard">
            <div class="fcard-inner">
              <div class="face front">
                <span class="label">${esc(topic.title)} / ${i + 1}</span>
                <div class="term">${esc(card.term)}</div>
                <span class="sticker lilac">${esc(card.type)}</span>
                <span class="hint">Which meaning is correct?</span>
              </div>
              <div class="face back lined">
                <div class="spiral-strip"></div>
                <span class="label back-label" id="verdict"></span>
                <p class="back-term">${esc(card.term)}</p>
                <p class="meaning">${esc(card.meaning)}</p>
                <span class="label back-label">In a sentence</span>
                ${card.examples.map((ex) => `<p class="ex">${esc(ex)}</p>`).join('')}
              </div>
            </div>
          </div>
        </div>
        <div class="meaning-options" role="group" aria-label="Possible meanings">
          ${opts.map((j, k) => `<button class="option meaning-opt" data-j="${j}" style="--rot:${['-1deg', '0.8deg', '-0.5deg'][k % 3]}"><span class="key">${'ABC'[k]}</span>${esc(cards[j].meaning)}<span class="mark" aria-hidden="true"></span></button>`).join('')}
        </div>
        <div class="flash-controls" id="next-wrap"></div>
      </div>
    </section>
  </div>`;

  const timerEl = document.getElementById('ftimer');
  const buttons = Array.from(app.querySelectorAll('.meaning-opt'));
  let locked = Boolean(prior);
  let interval = null;
  let ending = false;

  function paint(choiceJ, correct) {
    buttons.forEach((b) => {
      b.disabled = true;
      const j = Number(b.dataset.j);
      if (j === i) { b.classList.add('correct'); b.querySelector('.mark').textContent = '✓'; }
      else if (j === choiceJ) { b.classList.add('wrong'); b.querySelector('.mark').textContent = '✕'; }
      else b.classList.add('faded');
    });
    const v = document.getElementById('verdict');
    v.textContent = correct ? `✓ Correct, +${POINTS.flipCorrect} pts` : '✕ Not this time';
    v.classList.add(correct ? 'ok' : 'no');
    const last = i >= cards.length - 1;
    document.getElementById('next-wrap').innerHTML = `<button class="btn" id="next-card">${last ? 'Finish quiz' : 'Next card'}</button>`;
    document.getElementById('next-card').addEventListener('click', async () => {
      flip.current = i + 1;
      try { await saveWeek(); } catch (err) { toast(errText(err)); }
      ctx.rerender();
    });
    document.getElementById('next-card').focus();
  }

  if (prior) paint(prior.choice, prior.correct);

  buttons.forEach((b) => b.addEventListener('click', async () => {
    if (locked) return;
    locked = true;
    const j = Number(b.dataset.j);
    const correct = j === i;
    flip.answers[i] = { choice: j, correct };
    paint(j, correct);
    const lan = document.getElementById('lanyard');
    setTimeout(() => {
      document.getElementById('fcard').classList.add('flipped');
      lan.classList.add('swing');
    }, 650);
    try {
      await saveWeek();
      await recordCardResult(flip.topic, i, correct);
    } catch (err) { toast(errText(err)); }
  }));

  function tick() {
    const left = deadline - now();
    setTimer(timerEl, left, FLIP_MS);
    if (left <= 0 && !ending) {
      ending = true;
      clearInterval(interval);
      finishFlip(app, ctx, true);
    }
  }
  tick();
  interval = setInterval(tick, 250);
  return () => clearInterval(interval);
}

async function finishFlip(app, ctx, timedOut) {
  const { S, data } = ctx;
  const flip = S.week.flip;
  if (flip.done) { ctx.go('#/flip'); return; }
  const cards = data.topics[flip.topic].cards;
  const score = Object.values(flip.answers).filter((a) => a.correct).length;
  const pts = flipPoints(score, cards.length);
  Object.assign(flip, { done: true, score, total: cards.length, points: pts, timedOut: Boolean(timedOut), finishedAt: now() });
  try {
    await saveWeek();
    await addPoints('flip', pts);
    await addToList('flipCompleted', flip.topic);
    await completePart('flip');
  } catch (err) { toast(errText(err)); }

  app.innerHTML = `
  <div class="question-page enter">
    <header class="page-head">
      <span class="label">Word Flip complete${timedOut ? ' / time ran out' : ''}</span>
      <div class="result-score">${score}/${cards.length}</div>
      <div class="sticker-row"><span class="sticker blue">+${pts} pts</span>${score === cards.length ? `<span class="sticker peach">Perfect bonus +${POINTS.flipPerfectBonus}</span>` : ''}</div>
      <span class="hand">your Word Flip streak is safe this week</span>
    </header>
    <section class="review-list">
      ${cards.map((c, j) => {
        const a = flip.answers[j];
        const ok = a && a.correct;
        return `<article class="paper plain review-item ${ok ? 'good' : 'bad'}">
          <span class="sticker ${ok ? 'blue' : 'red'}" style="float:right">${ok ? '✓ Correct' : a ? '✕ Wrong' : '✕ No answer'}</span>
          <h3>${esc(c.term)}</h3>
          <p style="margin:6px 0">${esc(c.meaning)}</p>
          ${c.examples.map((ex) => `<p class="hand" style="font-size:1.25rem;margin:4px 0">${esc(ex)}</p>`).join('')}
        </article>`;
      }).join('')}
    </section>
    <p class="on-cloth" style="margin-top:18px;font-size:.9rem">Cards you got wrong will come back in tomorrow's warm-up — and in <a href="#/topics/${flip.topic}" style="color:inherit">past topics</a> any time.</p>
    <div class="btn-row" style="margin-top:24px">
      <a class="btn" href="#/topics/${flip.topic}">Study the cards</a>
      <a class="btn ghost" href="#/">Back to desk</a>
    </div>
  </div>`;
  toast('Word Flip complete for this week.');
}
