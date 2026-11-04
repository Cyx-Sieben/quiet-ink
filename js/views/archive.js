/**
 * Mistakes, archive (past topics and past writing) and settings.
 */

import { esc, toast, ORN } from '../ui.js';
import { stamp, weekNumber } from '../week.js';
import * as store from '../storage.js';

/* ---------------------------------------------------------------- Mistakes */
export function renderMistakes(app, ctx) {
  const { state, data } = ctx;
  const byId = new Map(data.questions.map((q) => [q.id, q]));
  const entries = Object.entries(state.grammar.mistakes)
    .filter(([id]) => byId.has(id))
    .sort((a, b) => String(b[1].last).localeCompare(String(a[1].last)));

  app.innerHTML = `
  <div class="enter">
    <header class="page-head">
      <span class="label">Revision notebook</span>
      <h1 class="pixel-title">My Mistakes</h1>
      <span class="hand red">learn from every miss</span>
      <p class="lead">Every puzzle you answered incorrectly is collected here. Read the explanation, then mark it as revised when you are confident.</p>
    </header>
    ${entries.length ? `<div class="stack">${entries.map(([id, m]) => {
      const q = byId.get(id);
      return `
      <article class="paper plain mistake">
        <div class="sticker-row">
          <span class="sticker ${q.category === 'grammar' ? 'lilac' : 'mint'}">${q.category === 'grammar' ? 'Grammar' : 'Word choice'}</span>
          <span class="sticker red" style="--rot:2deg">Missed ${m.count}×</span>
        </div>
        <p class="sent">${esc(q.sentence.replace('____', `[${q.answer}]`))}</p>
        ${m.choice ? `<p class="muted" style="margin:0 0 6px">Your last answer: <s>${esc(m.choice)}</s></p>` : ''}
        <p style="margin:0 0 12px">${esc(q.explanation)}</p>
        <button class="btn ghost small" data-revise="${esc(id)}">Mark as revised</button>
      </article>`;
    }).join('')}</div>` : `<div class="paper notice"><span class="hand">nothing here yet</span><p style="margin-top:8px">Mistakes from your puzzle sets will appear here.</p></div>`}
  </div>`;

  app.querySelectorAll('[data-revise]').forEach((btn) => {
    btn.addEventListener('click', () => {
      delete state.grammar.mistakes[btn.dataset.revise];
      ctx.save();
      toast('Marked as revised.');
      ctx.rerender();
    });
  });
}

/* ----------------------------------------------------------------- Archive */
export function renderArchive(app, ctx) {
  const { state, data } = ctx;
  const topics = state.flash.completed.map((i) => ({ i, t: data.topics[i] })).filter((x) => x.t);
  const writing = Object.entries(state.weeks)
    .filter(([, w]) => w.reflection && w.reflection.submitted)
    .sort((a, b) => b[0].localeCompare(a[0]));
  const promptById = new Map(data.prompts.map((p) => [p.id, p]));

  app.innerHTML = `
  <div class="enter">
    <header class="page-head">
      <span class="label">Archive</span>
      <h1 class="pixel-title">The Studio Wall</h1>
      <span class="hand">everything you have collected</span>
    </header>

    <section class="paper spiral" style="margin-bottom:30px">
      <span class="label">Past topics / ${topics.length}</span>
      ${topics.length ? `<div class="polaroid-grid" style="margin-top:18px">${topics.map(({ i, t }) => `
        <a class="polaroid" href="#/archive/topic/${i}">
          <div class="shot"><span class="term-small">${esc(t.cards[0] ? t.cards[0].term : t.title)}<br><small style="font-family:var(--font-body);font-size:.7rem;color:#6f6e69">+ ${Math.max(0, t.cards.length - 1)} more</small></span></div>
          <div class="caption">${i + 1}. ${esc(t.title)}</div>
        </a>`).join('')}</div>` : '<p class="muted" style="margin-top:10px">Finish a flashcard topic and it will be pinned here.</p>'}
    </section>

    <section class="paper spiral">
      <span class="label">My writing / ${writing.length}</span>
      ${writing.length ? `<div class="polaroid-grid" style="margin-top:18px">${writing.map(([k, w]) => {
        const p = promptById.get(w.reflection.id);
        return `
        <a class="polaroid" href="#/archive/writing/${k}">
          <div class="shot dark"><span class="term-small">${esc(p ? p.name : 'Reflection')}</span></div>
          <div class="caption">Week ${weekNumber(state.firstWeek, k)} · ${w.reflection.words} words</div>
        </a>`;
      }).join('')}</div>` : '<p class="muted" style="margin-top:10px">Your submitted reflections will be kept here, week by week.</p>'}
    </section>
  </div>`;
}

export function renderTopicReview(app, ctx, index) {
  const { state, data } = ctx;
  const topic = data.topics[index];
  const allowed = state.flash.completed.includes(index);
  if (!topic || !allowed) {
    app.innerHTML = '<div class="paper notice"><p class="pixel-title">Topic not unlocked</p><p>Only topics you have completed can be reviewed. <a href="#/archive">Back to the archive</a>.</p></div>';
    return;
  }
  app.innerHTML = `
  <div class="enter">
    <header class="page-head">
      <span class="label">Archive / Topic ${index + 1}</span>
      <h1 class="pixel-title">${esc(topic.title)}</h1>
      <p class="lead">${esc(topic.description)}</p>
    </header>
    <div class="review-list">${topic.cards.map((c) => `
      <article class="paper plain review-item">
        <span class="sticker lilac" style="float:right">${esc(c.type)}</span>
        <h3>${esc(c.term)}</h3>
        <p style="margin:6px 0">${esc(c.meaning)}</p>
        ${c.examples.map((ex) => `<p class="hand" style="font-size:1.3rem;transform:none;display:block;margin:4px 0">${esc(ex)}</p>`).join('')}
      </article>`).join('')}</div>
    <p style="margin-top:24px"><a class="btn ghost" href="#/archive">← Back to archive</a></p>
  </div>`;
}

export function renderWritingEntry(app, ctx, key) {
  const { state, data } = ctx;
  const w = state.weeks[key];
  if (!w || !w.reflection || !w.reflection.submitted) {
    app.innerHTML = '<div class="paper notice"><p class="pixel-title">Not found</p><p><a href="#/archive">Back to the archive</a></p></div>';
    return;
  }
  const p = data.prompts.find((x) => x.id === w.reflection.id);
  app.innerHTML = `
  <div class="enter">
    <section class="band torn-both concept-head">
      <div class="band-inner">
        <span class="label">Week ${weekNumber(state.firstWeek, key)} / ${esc(stamp(w.reflection.submittedAt))}</span>
        <h1 class="band-giant">${esc(p ? p.name : 'Reflection')}</h1>
        ${ORN.replace('class="ornaments"', 'class="ornaments" style="color:var(--band-ink)"')}
      </div>
    </section>
    ${p ? `<div class="prompt-sticky" style="margin-bottom:26px"><span class="tape red"></span>${esc(p.prompt)}</div>` : ''}
    <section class="paper spiral">
      <span class="sticker peach">${w.reflection.words} words</span>
      <div class="submitted-text lined" style="margin-top:16px;padding:4px 18px 10px 60px;border-radius:12px">${esc(w.reflection.text)}</div>
    </section>
    <p style="margin-top:24px"><a class="btn ghost" href="#/archive">← Back to archive</a></p>
  </div>`;
}

/* ---------------------------------------------------------------- Settings */
export function renderSettings(app, ctx) {
  const theme = store.getTheme();
  app.innerHTML = `
  <div class="enter">
    <header class="page-head">
      <span class="label">Settings</span>
      <h1 class="pixel-title">Desk Drawer</h1>
      <span class="hand">backups and preferences</span>
    </header>
    <div class="stack">
      <section class="paper plain">
        <span class="label">Appearance</span>
        <p style="margin:10px 0">
          <label for="theme">Theme</label><br>
          <select id="theme">
            <option value="auto" ${theme === 'auto' ? 'selected' : ''}>Follow my device</option>
            <option value="light" ${theme === 'light' ? 'selected' : ''}>Light desk</option>
            <option value="dark" ${theme === 'dark' ? 'selected' : ''}>Dark desk</option>
          </select>
        </p>
      </section>

      <section class="paper plain">
        <span class="label">Your progress</span>
        <p style="margin-top:10px">Progress is stored only in this browser. Export a backup regularly, and import it to continue on another device or browser.</p>
        ${store.isStorageOk() ? '' : '<p class="sticker red">This browser is blocking storage, so progress will be lost when you close the page.</p>'}
        <div class="btn-row">
          <button class="btn" id="export">Export progress</button>
          <label class="btn ghost" for="import" style="cursor:pointer">Import progress</label>
          <input type="file" id="import" accept="application/json,.json" class="visually-hidden">
        </div>
      </section>

      <section class="paper plain">
        <span class="label">Start again</span>
        <p style="margin-top:10px">This deletes all scores, flashcard progress and writing from this browser. Export a backup first if you want to keep anything.</p>
        <button class="btn danger" id="reset">Reset all progress</button>
      </section>
    </div>
  </div>`;

  document.getElementById('theme').addEventListener('change', (e) => {
    store.setTheme(e.target.value);
    toast('Theme updated.');
  });
  document.getElementById('export').addEventListener('click', () => store.exportProgress());
  document.getElementById('import').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (!window.confirm('Replace your current progress with this file?')) return;
      store.importProgress(text);
      toast('Progress imported.');
      ctx.go('#/');
    } catch (err) {
      toast(err.message || 'That file could not be imported.');
    } finally {
      e.target.value = '';
    }
  });
  document.getElementById('reset').addEventListener('click', () => {
    if (!window.confirm('Delete all progress in this browser?')) return;
    if (!window.confirm('Are you sure? This cannot be undone.')) return;
    store.resetProgress();
    toast('Progress reset.');
    ctx.go('#/');
  });
}
