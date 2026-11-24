/**
 * Part 4: Speaking Practice.
 * One prompt per week: a structured answer framework (Point-Reason-Example-Point),
 * a phrase bank, critical-thinking nudges, then you write your spoken-style answer,
 * self-review against a checklist, and can rewrite once. All private.
 */
import { esc, toast, errText, countWords, flameBadge } from '../lib/ui.js';
import { dayDate, nextWeek } from '../lib/week.js';
import { POINTS, speakPoints, promptOfWeek, liveStreak } from '../lib/rules.js';
import { saveWeek, addPoints, completePart } from '../lib/session.js';

export function renderSpeaking(app, ctx) {
  const { S, data } = ctx;
  const prompt = promptOfWeek(data.speaking, S.weekKey);
  if (!prompt) {
    app.innerHTML = '<div class="paper notice"><p class="pixel-title">No speaking prompts found</p><p>Add entries to public/data/speaking_prompts.json.</p></div>';
    return;
  }
  const state = S.week.speak;
  const streak = liveStreak(S.profile.streaks.speak, S.weekKey);

  const intro = `
  <header class="page-head">
    <span class="label">Part four / ${esc(prompt.field)}</span>
    <h1 class="pixel-title">Speaking Practice</h1>
    <span class="hand">say it in your head, then type it as you'd speak it</span>
    <div class="sticker-row">
      ${flameBadge(streak, { label: 'Speak' })}
      <span class="sticker blue">+${S.week.points.speak} pts this week</span>
    </div>
  </header>

  <section class="band torn-both concept-head">
    <div class="band-inner">
      <span class="label">This week's talking point</span>
      <h1 class="band-giant">${esc(prompt.title)}</h1>
      <span class="ornaments" style="color:var(--band-ink)" aria-hidden="true">✸ ✦ ♣</span>
    </div>
  </section>

  <div class="grid-2" style="align-items:start;margin:26px 0">
    <div class="paper spiral">
      <span class="label">The situation</span>
      <p class="lead" style="margin-top:8px">${esc(prompt.prompt)}</p>
    </div>
    <div class="prompt-sticky">
      <span class="tape red"></span>
      <span class="label" style="color:inherit;opacity:.7">Follow this shape</span>
      <ol class="framework-list">
        ${prompt.framework.map((f) => `<li>${esc(f)}</li>`).join('')}
      </ol>
    </div>
  </div>

  <div class="grid-2" style="align-items:start;margin-bottom:26px">
    <section class="paper plain">
      <span class="label">Phrase bank — steal these</span>
      <div class="phrase-bank">
        ${prompt.phrases.map((p) => `<span class="sticker mint" style="--rot:${(Math.random() * 4 - 2).toFixed(1)}deg">"${esc(p)}"</span>`).join('')}
      </div>
    </section>
    <section class="paper plain">
      <span class="label">Push your thinking</span>
      <ul class="usage-list">
        ${prompt.nudges.map((n) => `<li>${esc(n)}</li>`).join('')}
      </ul>
    </section>
  </div>`;

  if (state && state.reviewed) {
    app.innerHTML = `
    <div class="enter">
      ${intro}
      <section class="paper spiral">
        <div class="sticker-row" style="margin-bottom:14px">
          <span class="sticker blue">✓ Done this week</span>
          <span class="sticker peach" style="--rot:2deg">${countWords(state.draft)} words</span>
        </div>
        <h2 class="piece-title">${esc(state.title || prompt.title)}</h2>
        <div class="submitted-text">${esc(state.draft)}</div>
        <p class="muted" style="margin-top:18px">A new talking point arrives on ${esc(dayDate(nextWeek(S.weekKey)))}.</p>
      </section>
    </div>`;
    return;
  }

  const stage = state && state.draft && !state.backToDraft && state.submitted ? 'review' : 'draft';

  if (stage === 'draft') {
    app.innerHTML = `
    <div class="enter">
      ${intro}
      <section>
        <div class="sticker-row" style="margin-bottom:16px">
          <span class="sticker peach">Draft first, then self-review</span>
          <span class="sticker mint" style="--rot:2deg">No word limit — write it exactly as you'd say it</span>
          <span class="sticker blue" style="--rot:-1deg">+${POINTS.speakDraft} pts for the draft, +${POINTS.speakReview} for the review</span>
          <span class="muted" id="saved" style="font-size:.85rem"></span>
        </div>
        <label class="visually-hidden" for="title">Title</label>
        <input id="title" class="title-input" maxlength="120" placeholder="Give your answer a title (optional)" value="${esc(state ? state.title : '')}">
        <div class="editor-wrap">
          <label for="editor" class="visually-hidden">Your spoken answer</label>
          <textarea id="editor" class="editor lined" spellcheck="true" placeholder="Imagine the person in front of you. Say it out loud in your head first, then type it here exactly as you'd say it — including the 'um, let me think' if that's how you really talk.">${esc(state ? state.draft : '')}</textarea>
          <span class="wordcount" id="wc">0 words</span>
        </div>
        <div class="btn-row" style="margin-top:22px">
          <button class="btn" id="to-review">I'm done — self-review my answer</button>
          <span class="hand" style="color:#fff">you can still rewrite after the review</span>
        </div>
      </section>
    </div>`;
    wireDraft(app, ctx, prompt);
  } else {
    app.innerHTML = `
    <div class="enter">
      ${intro}
      <section class="paper spiral">
        <span class="label">Self-review — be honest, this is for you</span>
        <p class="muted" style="margin:6px 0 12px;font-size:.9rem">Tick what you truly did. Unticked boxes are your homework for the rewrite.</p>
        <div class="checklist" id="checklist">
          ${prompt.checklist.map((c, i) => `
          <label class="check-item">
            <input type="checkbox" data-c="${i}">
            <span>${esc(c)}</span>
          </label>`).join('')}
        </div>
        <div class="stack" style="margin-top:18px">
          <span class="label">Your draft</span>
          <div class="submitted-text" style="font-size:.95rem">${esc(state.draft)}</div>
        </div>
        <div class="btn-row" style="margin-top:20px">
          <button class="btn" id="finish">Finish &amp; save my answer</button>
          <button class="btn ghost" id="rewrite">Rewrite my draft first</button>
        </div>
        <p class="muted" id="rl" style="font-size:.85rem;margin:10px 0 0"></p>
      </section>
    </div>`;
    wireReview(app, ctx, prompt);
  }
}

function wireDraft(app, ctx, prompt) {
  const { S } = ctx;
  const title = document.getElementById('title');
  const editor = document.getElementById('editor');
  const wc = document.getElementById('wc');
  const saved = document.getElementById('saved');
  let timer = null;
  let dirty = false;

  const count = () => {
    const n = countWords(editor.value);
    wc.textContent = `${n} ${n === 1 ? 'word' : 'words'}`;
    return n;
  };

  async function saveDraft() {
    timer = null;
    if (!S.week.speak) S.week.speak = { title: '', draft: '', reviewed: false };
    S.week.speak.title = title.value;
    S.week.speak.draft = editor.value;
    try {
      await saveWeek();
      dirty = false;
      saved.textContent = 'Draft saved';
    } catch (err) { saved.textContent = 'Could not save draft'; }
  }

  const schedule = () => {
    dirty = true;
    saved.textContent = 'Saving...';
    clearTimeout(timer);
    timer = setTimeout(saveDraft, 1200);
  };
  editor.addEventListener('input', () => { count(); schedule(); });
  title.addEventListener('input', schedule);

  document.getElementById('to-review').addEventListener('click', async () => {
    const text = editor.value.trim();
    if (!countWords(text)) { toast('Write your spoken answer first.'); editor.focus(); return; }
    await saveDraft();
    try {
      if (!S.week.speak.submitted) {
        S.week.speak.submitted = true;
        await saveWeek();
        await addPoints('speak', POINTS.speakDraft);
        await completePart('speak');
      }
      S.week.speak.backToDraft = false;
      await saveWeek();
      ctx.rerender();
    } catch (err) { toast(errText(err)); }
  });

  count();
  return () => {
    if (timer && dirty) { clearTimeout(timer); saveDraft(); }
  };
}

function wireReview(app, ctx, prompt) {
  const { S } = ctx;
  document.getElementById('rewrite').addEventListener('click', () => {
    // Drop back into the draft editor; submitted points are kept, never re-awarded.
    S.week.speak.submitted = true; // stays set so points are not re-awarded
    S.week.speak.backToDraft = true;
    ctx.rerender();
  });

  document.getElementById('finish').addEventListener('click', async () => {
    const ticks = Array.from(document.querySelectorAll('[data-c]'));
    const ticked = ticks.filter((t) => t.checked).length;
    const rl = document.getElementById('rl');
    rl.textContent = `You ticked ${ticked} of ${ticks.length}.`;
    try {
      S.week.speak.reviewed = true;
      S.week.speak.reviewTicks = ticks.map((t) => t.checked);
      S.week.speak.words = countWords(S.week.speak.draft);
      await saveWeek();
      await addPoints('speak', POINTS.speakReview);
      await completePart('speak');
      toast(`Speaking practice done: +${speakPoints(true)} pts total.`);
      ctx.rerender();
    } catch (err) { toast(errText(err)); }
  });
}
