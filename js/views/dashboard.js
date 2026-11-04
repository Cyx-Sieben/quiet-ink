/**
 * Dashboard: the clipboard desk with this week's three tasks.
 */

import { esc, binderClip, typewriter, arrowDoodle, ORN, squiggle } from '../ui.js';
import { weekRange, msUntilReset, formatCountdown } from '../week.js';
import { SETS_PER_WEEK, streak, flashTopicIndex, ensureReflection } from '../progress.js';

/* Public domain lines about writing. */
const QUOTES = [
  { text: 'The difference between the almost right word and the right word is really a large matter.', by: 'Mark Twain, letter to George Bainton, 1888' },
  { text: 'Either write something worth reading or do something worth writing.', by: 'Benjamin Franklin, Poor Richard’s Almanack, 1738' },
  { text: 'Not that the story need be long, but it will take a long while to make it short.', by: 'Henry David Thoreau, letter, 1857' },
  { text: 'Language is fossil poetry.', by: 'Ralph Waldo Emerson, “The Poet”, 1844' }
];

function pickGreeting(ctx) {
  // Sometimes show a line from the user's own past writing.
  const past = Object.entries(ctx.state.weeks)
    .filter(([k, w]) => k !== ctx.key && w.reflection && w.reflection.submitted && w.reflection.text)
    .map(([k, w]) => ({ key: k, text: w.reflection.text }));
  if (past.length && Math.random() < 0.4) {
    const pick = past[Math.floor(Math.random() * past.length)];
    const sentences = pick.text.split(/(?<=[.!?])\s+/).filter((s) => s.split(/\s+/).length >= 6 && s.length < 220);
    if (sentences.length) {
      return { text: sentences[Math.floor(Math.random() * sentences.length)], by: `You, week of ${pick.key}`, own: true };
    }
  }
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

export function renderDashboard(app, ctx) {
  const { rec, data, weekNo, key, state } = ctx;

  // Part 1 status
  const setsDone = rec.sets.length;
  const p1Status = setsDone >= SETS_PER_WEEK ? 'All sets done' : rec.active ? 'Set in progress' : `${setsDone} of ${SETS_PER_WEEK} sets done`;
  const p1Sticker = setsDone >= SETS_PER_WEEK ? 'blue' : 'mint';
  const dots = Array.from({ length: SETS_PER_WEEK }, (_, i) => `<span class="dot ${i < setsDone ? 'on' : ''}"></span>`).join('');

  // Part 2 status
  const tIndex = flashTopicIndex(ctx);
  const topic = data.topics[tIndex];
  let p2Status, p2Sticker, p2Title;
  if (rec.flash && rec.flash.done) { p2Status = 'Flashcards complete'; p2Sticker = 'blue'; }
  else if (!topic) { p2Status = 'Every topic finished'; p2Sticker = 'blue'; }
  else if (!topic.cards || !topic.cards.length) { p2Status = 'Cards not added yet'; p2Sticker = 'peach'; }
  else if (rec.flash) { p2Status = `${rec.flash.learned.length} of ${topic.cards.length} learned`; p2Sticker = 'lilac'; }
  else { p2Status = 'New topic waiting'; p2Sticker = 'lilac'; }
  p2Title = topic ? topic.title : 'All topics done';

  // Part 3 status
  const concept = ensureReflection(ctx);
  const submitted = rec.reflection && rec.reflection.submitted;
  const p3Status = submitted ? 'Submitted' : rec.reflection && rec.reflection.draft ? 'Draft saved' : 'Writing task open';
  const p3Sticker = submitted ? 'blue' : 'peach';

  const s = streak(state, key);
  const q = pickGreeting(ctx);

  app.innerHTML = `
  <div class="enter">
    <section class="hero">
      <div class="paper spiral hero-paper torn-shadow">
        <span class="label">Week ${weekNo} &nbsp;/&nbsp; ${esc(weekRange(key))}</span>
        <div><span class="hand">hi, writer</span></div>
        <h1 class="display hero-title">Quiet<br>Ink</h1>
        ${squiggle()}
        <p class="lead" style="margin-top:14px">Three small tasks, one calm week. Choose words carefully, collect new phrases, and write something worth keeping.</p>
        ${ORN}
      </div>
      <div class="hero-side">
        <div class="torn-shadow">
          <div class="countdown-note torn-bottom">
            <span class="label">Next reset</span>
            <div class="count" id="countdown">${formatCountdown(msUntilReset())}</div>
            <span class="hand">Monday, 00:00</span>
          </div>
        </div>
        <span class="sticker blue streak-badge">✦ ${s}-week streak</span>
        <div class="paper plain quote-card">
          <span class="tape"></span>
          <blockquote>${esc(q.text)}</blockquote>
          <cite class="label">${esc(q.by)}</cite>
          ${typewriter()}
        </div>
      </div>
    </section>

    <section class="board" aria-label="This week's tasks">
      <div class="clip-top">${binderClip()}</div>
      <div class="grid-3">
        <article class="paper part-card">
          <div class="clip-mini">${binderClip()}</div>
          <span class="label">Part one / Word puzzles</span>
          <h2 class="pixel-title">Teka-Teki</h2>
          <p class="grow muted">Fill the blank with the right word. Five sets of five questions, any time this week.</p>
          <div class="dots" aria-label="${setsDone} of 5 sets done">${dots}</div>
          <span class="sticker ${p1Sticker}" style="--rot:-2deg;align-self:flex-start">${p1Status}</span>
          <a class="btn" href="#/puzzles">${setsDone >= SETS_PER_WEEK ? 'Review sets' : rec.active ? 'Resume set' : 'Open puzzles'}</a>
        </article>

        <article class="paper part-card">
          <div class="clip-mini">${binderClip()}</div>
          <span class="label">Part two / Flashcards${topic ? ` / Topic ${tIndex + 1}` : ''}</span>
          <h2 class="pixel-title">${esc(p2Title)}</h2>
          <p class="grow muted">${topic ? esc(topic.description) : 'You have completed every topic. Review them in the archive.'}</p>
          <span class="sticker ${p2Sticker}" style="--rot:1.5deg;align-self:flex-start">${p2Status}</span>
          <a class="btn" href="#/flashcards">Open cards</a>
        </article>

        <article class="paper part-card">
          <div class="clip-mini">${binderClip()}</div>
          <span class="label">Part three / Weekly reflection</span>
          <h2 class="pixel-title">${concept ? esc(concept.name) : 'Reflection'}</h2>
          <p class="grow muted">${concept ? esc(concept.field) : ''}. One attempt this week; aim for at least 150 words.</p>
          <span class="sticker ${p3Sticker}" style="--rot:-1deg;align-self:flex-start">${p3Status}</span>
          <a class="btn" href="#/reflection">${submitted ? 'Read my piece' : 'Start writing'}</a>
        </article>
      </div>
    </section>

    <section class="band torn-both" aria-hidden="true">
      <div class="band-inner">
        <div class="band-giant">Read. Write. Repeat.<span class="orn">✸ ✦ ♣</span></div>
      </div>
    </section>
  </div>`;

  const timer = setInterval(() => {
    const el = document.getElementById('countdown');
    if (!el) return;
    const ms = msUntilReset();
    el.textContent = formatCountdown(ms);
    if (ms < 1000) ctx.rerender();
  }, 30000);

  return () => clearInterval(timer);
}
