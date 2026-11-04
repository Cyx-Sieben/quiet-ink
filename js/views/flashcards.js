/**
 * Part 2: Weekly flashcards.
 * One topic of 10 cards per week. Finishing it locks the next topic until Monday.
 */

import { esc, toast, binderClip } from '../ui.js';
import { flashTopicIndex } from '../progress.js';
import { dayDate, addDays } from '../week.js';

export function renderFlashcards(app, ctx) {
  const { rec, data, state, key } = ctx;
  const tIndex = flashTopicIndex(ctx);
  const topic = data.topics[tIndex];
  const nextMonday = dayDate(addDays(key, 7));

  // This week's topic is already finished: show the sealed next topic.
  if (rec.flash && rec.flash.done) {
    const next = data.topics[state.flash.completed.length];
    app.innerHTML = `
    <div class="enter">
      ${head(topic, tIndex, data.topics.length)}
      <section class="paper spiral" style="text-align:center">
        <span class="sticker blue">✦ Topic complete</span>
        <p class="lead" style="margin:18px auto 6px;max-width:560px">You learned all ten cards in <em>${esc(topic.title)}</em>. Review them any time in the archive.</p>
        <div class="sealed">
          <span class="label">Next topic</span>
          <p class="pixel-title" style="font-size:1.8rem;margin:8px 0">${next ? esc(next.title) : 'All done'}</p>
          <span class="hand red">opens ${esc(nextMonday)}</span>
          <div class="seal-tape">LOCKED</div>
          <div class="seal-tape two">LOCKED</div>
        </div>
        <div class="btn-row" style="justify-content:center;margin-top:28px">
          <a class="btn" href="#/archive/topic/${tIndex}">Review this topic</a>
          <a class="btn ghost" href="#/">Back to desk</a>
        </div>
      </section>
    </div>`;
    return;
  }

  if (!topic) {
    app.innerHTML = `<div class="paper notice enter"><p class="pixel-title">Every topic finished</p><p>You have completed all ${data.topics.length} topics. Add more to data/flashcard_topics.json, or review them in the <a href="#/archive">archive</a>.</p></div>`;
    return;
  }

  if (!topic.cards || !topic.cards.length) {
    app.innerHTML = `
    <div class="enter">
      ${head(topic, tIndex, data.topics.length)}
      <div class="paper notice"><span class="hand red">cards coming soon</span><p style="margin-top:10px">This topic has no cards yet. Add ten cards for "${esc(topic.title)}" in data/flashcard_topics.json, and they will appear here.</p></div>
    </div>`;
    return;
  }

  if (!rec.flash) {
    rec.flash = { topic: tIndex, learned: [], done: false, doneAt: null };
    ctx.save();
  }

  let current = 0;
  const cards = topic.cards;

  app.innerHTML = `
  <div class="enter">
    ${head(topic, tIndex, data.topics.length)}
    <section class="board">
      <div class="clip-top">${binderClip()}</div>
      <div class="flash-stage">
        <div class="dots" id="dots" aria-hidden="true"></div>
        <div class="lanyard" id="lanyard">
          <div class="strap"></div>
          <div class="badge-clip"></div>
          <button class="fcard" id="fcard" aria-pressed="false" aria-label="Flashcard. Press to flip."></button>
        </div>
        <div class="flash-controls">
          <button class="btn ghost small" id="prev" aria-label="Previous card">← Prev</button>
          <span class="counter" id="counter"></span>
          <button class="btn ghost small" id="next" aria-label="Next card">Next →</button>
        </div>
        <div class="flash-controls">
          <button class="btn" id="learn"></button>
        </div>
        <p class="on-cloth" style="font-size:.85rem;margin:0">Tip: Space flips the card, arrow keys move between cards.</p>
      </div>
    </section>
  </div>`;

  const fcard = document.getElementById('fcard');
  const lanyard = document.getElementById('lanyard');

  function draw(flipped = false) {
    const c = cards[current];
    const learned = rec.flash.learned.includes(current);
    fcard.classList.toggle('flipped', flipped);
    fcard.setAttribute('aria-pressed', String(flipped));
    fcard.innerHTML = `
      <div class="fcard-inner">
        <div class="face front">
          <span class="label">${esc(topic.title)} / ${current + 1}</span>
          <div class="term">${esc(c.term)}</div>
          <span class="sticker lilac">${esc(c.type)}</span>
          ${learned ? '<span class="sticker blue" style="--rot:3deg">✦ Learned</span>' : ''}
          <span class="hint">Tap to flip</span>
        </div>
        <div class="face back lined">
          <div class="spiral-strip"></div>
          <span class="label back-label">Meaning</span>
          <p class="meaning">${esc(c.meaning)}</p>
          <span class="label back-label">In a sentence</span>
          ${c.examples.map((ex) => `<p class="ex">${esc(ex)}</p>`).join('')}
        </div>
      </div>`;
    document.getElementById('counter').textContent = `${current + 1} / ${cards.length}`;
    document.getElementById('dots').innerHTML = cards.map((_, i) =>
      `<span class="dot ${rec.flash.learned.includes(i) ? 'on' : ''}" style="${i === current ? 'outline:2px solid #fff;outline-offset:2px' : ''}"></span>`).join('');
    const learnBtn = document.getElementById('learn');
    learnBtn.textContent = learned ? 'Unmark this card' : 'Mark as learned';
    learnBtn.classList.toggle('ghost', learned);
  }

  function flip() {
    const flipped = !fcard.classList.contains('flipped');
    fcard.classList.toggle('flipped', flipped);
    fcard.setAttribute('aria-pressed', String(flipped));
    lanyard.classList.remove('swing');
    void lanyard.offsetWidth; // restart animation
    lanyard.classList.add('swing');
  }

  function move(step) {
    current = (current + step + cards.length) % cards.length;
    draw(false);
  }

  function toggleLearned() {
    const list = rec.flash.learned;
    const i = list.indexOf(current);
    if (i >= 0) list.splice(i, 1);
    else list.push(current);
    ctx.save();

    if (list.length === cards.length) {
      rec.flash.done = true;
      rec.flash.doneAt = new Date().toISOString();
      if (!state.flash.completed.includes(tIndex)) state.flash.completed.push(tIndex);
      ctx.save();
      toast('Topic complete. The next one opens on Monday.');
      ctx.rerender();
      return;
    }
    // Move to the next card that is not learned yet.
    if (i < 0) {
      for (let s = 1; s <= cards.length; s++) {
        const n = (current + s) % cards.length;
        if (!list.includes(n)) { current = n; break; }
      }
    }
    draw(false);
  }

  fcard.addEventListener('click', flip);
  document.getElementById('prev').addEventListener('click', () => move(-1));
  document.getElementById('next').addEventListener('click', () => move(1));
  document.getElementById('learn').addEventListener('click', toggleLearned);

  const onKey = (e) => {
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.key === 'ArrowRight') move(1);
    else if (e.key === 'ArrowLeft') move(-1);
    else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); flip(); }
  };
  document.addEventListener('keydown', onKey);

  draw(false);
  return () => document.removeEventListener('keydown', onKey);
}

function head(topic, index, total) {
  return `
  <header class="page-head">
    <span class="label">Part two / Flashcards / Topic ${index + 1} of ${total}</span>
    <h1 class="pixel-title">${topic ? esc(topic.title) : 'Flashcards'}</h1>
    <span class="hand">this week's ten</span>
    ${topic ? `<p class="lead">${esc(topic.description)}</p>` : ''}
  </header>`;
}
