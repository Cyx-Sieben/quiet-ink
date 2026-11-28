/**
 * Part 3: Phrase Library.
 * One phrase family per week: what it means, where it came from, how to use it
 * and real examples — plus a two-question check to see if it stuck.
 */
import { esc, toast, errText, squiggle, flameBadge } from '../lib/ui.js';
import { now } from '../lib/clock.js';
import { dayDate, nextWeek } from '../lib/week.js';
import { POINTS, phraseOfWeek, phrasePoints, liveStreak } from '../lib/rules.js';
import { saveWeek, addPoints, completePart } from '../lib/session.js';

export function renderPhrases(app, ctx) {
  const { S, data } = ctx;
  const phrase = phraseOfWeek(data.phrases, S.weekKey);
  if (!phrase) {
    app.innerHTML = '<div class="paper notice"><p class="pixel-title">No phrases found</p><p>Add entries to public/data/phrases.json.</p></div>';
    return;
  }
  const state = S.week.phrases;
  const done = Boolean(state && state.read);
  const streak = liveStreak(S.profile.streaks.phrases, S.weekKey);

  app.innerHTML = `
  <div class="enter">
    <header class="page-head">
      <span class="label">Part three / ${esc(phrase.field)}</span>
      <h1 class="pixel-title">Phrase Library</h1>
      <span class="hand">read, learn the story, use it well</span>
      <div class="sticker-row">
        ${flameBadge(streak, { label: 'Phrases' })}
        <span class="sticker blue">+${S.week.points.phrases} pts this week</span>
        ${done ? '<span class="sticker mint">✓ read this week</span>' : ''}
      </div>
    </header>

    <section class="band torn-both concept-head">
      <div class="band-inner">
        <span class="label">This week's phrase</span>
        <h1 class="band-giant">${esc(phrase.title)}</h1>
        <span class="ornaments" style="color:var(--band-ink)" aria-hidden="true">✸ ✦ ♣</span>
      </div>
    </section>

    <div class="grid-2" style="align-items:start;margin:26px 0">
      <div class="paper spiral">
        <span class="label">What it means</span>
        ${phrase.what.map((t) => `<p class="serif" style="font-size:1.12rem;margin:12px 0">${esc(t)}</p>`).join('')}
      </div>
      <div class="prompt-sticky">
        <span class="tape red"></span>
        <span class="label" style="color:inherit;opacity:.7">Where it comes from</span>
        <p style="margin:8px 0 0">${esc(phrase.origin)}</p>
      </div>
    </div>

    <section class="paper plain">
      <span class="label">How to use it properly</span>
      <ul class="usage-list">
        ${phrase.usage.map((u) => `<li>${esc(u)}</li>`).join('')}
      </ul>
    </section>

    <section class="paper spiral">
      <span class="label">In real sentences</span>
      ${phrase.examples.map((ex, i) => `
        <p class="hand" style="font-size:1.5rem;transform:none;display:block;margin:14px 0 4px">${esc(ex)}</p>
        ${i < phrase.examples.length - 1 ? '<hr style="border:none;border-top:2px dashed var(--ink-soft);margin:8px 0">' : ''}`).join('')}
    </section>

    <section class="board" style="margin-top:26px">
      <div class="clip-top">${binderClipMini()}</div>
      <div style="padding:6px 8px 14px">
        <span class="label">Did it stick? — the two-question check</span>
        <p class="muted" style="margin:6px 0 10px;font-size:.9rem">Answer from memory, then check. ${POINTS.phraseCheck} extra points.</p>
        <div class="stack" id="check-area">
          ${!done ? `
          <button class="btn" id="start-check">Take the check</button>` : `
          <p class="muted" style="margin:0">You've read this week's phrase and taken the check. A new phrase arrives on ${esc(dayDate(nextWeek(S.weekKey)))}.</p>
          ${state.checked ? '<span class="sticker mint">✓ check done</span>' : ''}`}
        </div>
      </div>
    </section>
  </div>`;

  const start = document.getElementById('start-check');
  if (start) start.addEventListener('click', () => renderCheck(app, ctx, phrase));
}

async function markRead(ctx) {
  const { S } = ctx;
  if (!S.week.phrases) S.week.phrases = { id: null, read: false, checked: false };
  if (!S.week.phrases.read) {
    S.week.phrases.read = true;
    S.week.phrases.readAt = now();
    await saveWeek();
    await addPoints('phrases', POINTS.phraseRead);
    await completePart('phrases');
  }
}

function binderClipMini() {
  return `<svg class="clip" viewBox="0 0 150 70" aria-hidden="true" style="width:110px">
    <path d="M48 30 Q46 6 75 6 Q104 6 102 30" fill="none" stroke="#8a8a86" stroke-width="5" stroke-linecap="round"/>
    <path d="M18 34 H132 L120 66 H30 Z" fill="#a9a9a5" stroke="#6d6d69" stroke-width="1.5"/>
  </svg>`;
}

/** Two quick recall questions generated from the phrase content. */
function checkQuestions(phrase) {
  const qs = [];
  qs.push({
    q: 'Which best matches the meaning of the phrase?',
    options: shuffleStrings([
      firstSentence(phrase.what[0]),
      'It describes a frequent, regular event.',
      'It is a formal legal term for a contract clause.'
    ]),
    answer: firstSentence(phrase.what[0]),
    why: `The core meaning: ${phrase.what[0]}`
  });
  const usageHint = phrase.usage[0] || '';
  qs.push({
    q: 'Where does the phrase fit best?',
    options: shuffleStrings([
      usageSentence(phrase),
      'A chemistry lab report on pH levels.',
      'A cooking recipe listing ingredients.'
    ]),
    answer: usageSentence(phrase),
    why: `Usage note: ${usageHint}`
  });
  return qs;
}

function firstSentence(text) {
  return String(text).split('. ')[0].replace(/\.$/, '') + '.';
}

function usageSentence(phrase) {
  const short = phrase.title.toLowerCase();
  return `Everyday conversation, e.g. "${phrase.examples[0]}"`;
}

function shuffleStrings(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function renderCheck(app, ctx, phrase) {
  const { S } = ctx;
  await markRead(ctx);
  const qs = checkQuestions(phrase);
  let i = 0;
  let right = 0;

  const paint = () => {
    const item = qs[i];
    app.innerHTML = `
    <div class="question-page enter">
      <header class="page-head compact">
        <span class="label">Phrase check / ${i + 1} of ${qs.length}</span>
      </header>
      <section class="paper spiral">
        <p class="q-sentence">${esc(item.q)}</p>
        <div class="options" role="group" aria-label="Answer options">
          ${item.options.map((opt, k) => `
            <button class="option" data-opt="${esc(opt)}" style="--rot:${['-1.2deg', '0.9deg', '-0.7deg'][k % 3]}">
              <span class="key">${'ABC'[k]}</span><span class="opt-text">${esc(opt)}</span><span class="mark" aria-hidden="true"></span>
            </button>`).join('')}
        </div>
        <div id="feedback" aria-live="polite"></div>
      </section>
    </div>`;
    const buttons = Array.from(app.querySelectorAll('.option'));
    buttons.forEach((b) => b.addEventListener('click', async () => {
      buttons.forEach((x) => {
        x.disabled = true;
        if (x.dataset.opt === item.answer) { x.classList.add('correct'); x.querySelector('.mark').textContent = '✓'; }
        else if (x === b) { x.classList.add('wrong'); x.querySelector('.mark').textContent = '✕'; }
        else x.classList.add('faded');
      });
      const correct = b.dataset.opt === item.answer;
      if (correct) right += 1;
      document.getElementById('feedback').innerHTML = `
        <div class="explain lined ${correct ? 'good' : 'bad'}" style="margin-top:18px">
          <span class="hand ${correct ? '' : 'red'}">${correct ? '✓ Exactly right.' : '✕ The green one is correct.'}</span>
          <p style="margin:0">${esc(item.why)}</p>
          <div class="btn-row" style="margin-top:16px">
            <button class="btn" id="next">${i + 1 < qs.length ? 'Next' : 'Finish'}</button>
          </div>
        </div>`;
      document.getElementById('next').addEventListener('click', async () => {
        i += 1;
        if (i < qs.length) paint();
        else {
          if (!S.week.phrases.checked) {
            S.week.phrases.checked = true;
            S.week.phrases.checkScore = right;
            await saveWeek();
            await addPoints('phrases', POINTS.phraseCheck);
          }
          toast(`Check done: ${right}/${qs.length}.`);
          ctx.go('#/phrases');
        }
      });
    }));
  };
  paint();
}
