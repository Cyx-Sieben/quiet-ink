/**
 * Part 3: The weekly reflection.
 * One concept per week, one attempt. The draft autosaves; the final piece locks on submit.
 */

import { esc, countWords, toast, ORN } from '../ui.js';
import { ensureReflection, MIN_WORDS } from '../progress.js';
import { stamp, dayDate, addDays } from '../week.js';

export function renderReflection(app, ctx) {
  const { rec, key } = ctx;
  const concept = ensureReflection(ctx);

  if (!concept) {
    app.innerHTML = '<div class="paper notice"><p class="pixel-title">No concepts found</p><p>Add concepts to data/writing_prompts.json.</p></div>';
    return;
  }

  const r = rec.reflection;

  const conceptHtml = `
    <section class="band torn-both concept-head">
      <div class="band-inner">
        <span class="label">Part three / Weekly reflection / ${esc(concept.field)}</span>
        <h1 class="band-giant">${esc(concept.name)}</h1>
        ${ORN.replace('class="ornaments"', 'class="ornaments" style="color:var(--band-ink)"')}
      </div>
    </section>
    <div class="grid-2" style="align-items:start;margin-bottom:30px">
      <div class="paper plain">
        <span class="label">What it means</span>
        <p class="lead" style="margin-top:8px">${esc(concept.explanation)}</p>
      </div>
      <div class="prompt-sticky">
        <span class="tape red"></span>
        <span class="label" style="color:inherit;opacity:.7">This week's prompt</span>
        <p style="margin:8px 0 0">${esc(concept.prompt)}</p>
      </div>
    </div>`;

  if (r.submitted) {
    app.innerHTML = `
    <div class="enter">
      ${conceptHtml}
      <section class="paper spiral">
        <div class="sticker-row" style="margin-bottom:14px">
          <span class="sticker blue">✦ Submitted</span>
          <span class="sticker peach" style="--rot:2deg">${r.words} words</span>
        </div>
        <span class="label">${esc(stamp(r.submittedAt))}</span>
        <div class="submitted-text lined" style="margin-top:14px;padding:4px 18px 10px 60px;border-radius:12px">${esc(r.text)}</div>
        <p class="muted" style="margin-top:18px">A new concept arrives on ${esc(dayDate(addDays(key, 7)))}. All your pieces are kept in the <a href="#/archive">archive</a>.</p>
      </section>
    </div>`;
    return;
  }

  app.innerHTML = `
  <div class="enter">
    ${conceptHtml}
    <section>
      <div class="sticker-row" style="margin-bottom:16px">
        <span class="sticker peach">One attempt this week</span>
        <span class="sticker mint" style="--rot:2deg">Aim for ${MIN_WORDS}+ words</span>
        <span class="muted" id="saved" style="font-size:.85rem"></span>
      </div>
      <div class="editor-wrap">
        <label for="editor" class="visually-hidden">Your response</label>
        <textarea id="editor" class="editor lined" spellcheck="true" placeholder="Begin here. There is no rush.">${esc(r.draft || '')}</textarea>
        <span class="wordcount" id="wc">0000 words</span>
      </div>
      <div class="btn-row" style="margin-top:22px">
        <button class="btn" id="submit">Submit my piece</button>
        <span class="hand">once submitted, it is locked</span>
      </div>
    </section>
  </div>`;

  const editor = document.getElementById('editor');
  const wc = document.getElementById('wc');
  const saved = document.getElementById('saved');
  let saveTimer = null;

  function updateCount() {
    const n = countWords(editor.value);
    wc.textContent = `${String(n).padStart(4, '0')} words`;
    wc.style.background = n >= MIN_WORDS ? 'var(--blue)' : 'var(--ink)';
    return n;
  }

  editor.addEventListener('input', () => {
    updateCount();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      r.draft = editor.value;
      ctx.save();
      saved.textContent = 'Draft saved';
    }, 600);
  });

  document.getElementById('submit').addEventListener('click', () => {
    const text = editor.value.trim();
    const n = countWords(text);
    if (!n) {
      toast('Write something before you submit.');
      editor.focus();
      return;
    }
    const msg = n < MIN_WORDS
      ? `Your piece has ${n} words, which is below the suggested ${MIN_WORDS}. Submit anyway? You will not be able to edit it this week.`
      : 'Submit your piece? You will not be able to edit it this week.';
    if (!window.confirm(msg)) return;
    r.text = text;
    r.draft = text;
    r.words = n;
    r.submitted = true;
    r.submittedAt = new Date().toISOString();
    ctx.save();
    toast('Saved to your archive.');
    ctx.rerender();
  });

  updateCount();
  return () => {
    // Save any pending draft when leaving the page.
    if (saveTimer) {
      clearTimeout(saveTimer);
      if (!r.submitted) { r.draft = editor.value; ctx.save(); }
    }
  };
}
