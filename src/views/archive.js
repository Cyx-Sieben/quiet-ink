/**
 * Mistakes notebook and past flashcard topics.
 */
import { esc, toast, errText } from '../lib/ui.js';
import { clearMistake } from '../lib/session.js';

export function renderMistakes(app, ctx) {
  const { S, data } = ctx;
  const byId = new Map(data.questions.map((q) => [q.id, q]));
  const entries = Object.entries(S.priv.mistakes || {})
    .filter(([id]) => byId.has(id))
    .sort((a, b) => (b[1].last || 0) - (a[1].last || 0));

  app.innerHTML = `
  <div class="enter">
    <header class="page-head">
      <span class="label">Fill the Gap / Revision notebook</span>
      <h1 class="pixel-title">My Mistakes</h1>
      <span class="hand red">learn from every miss</span>
      <p class="lead">Every question you answered wrongly, or ran out of time on, is collected here. Mark it as revised when you feel confident.</p>
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
        <p class="muted" style="margin:0 0 6px">Your last answer: ${m.choice ? `<s>${esc(m.choice)}</s>` : 'time ran out'}</p>
        <p style="margin:0 0 12px">${esc(q.explanation)}</p>
        <button class="btn ghost small" data-revise="${esc(id)}">Mark as revised</button>
      </article>`;
    }).join('')}</div>` : '<div class="paper notice"><span class="hand">nothing here yet</span><p style="margin-top:8px">Mistakes from your sets will appear here.</p></div>'}
  </div>`;

  app.querySelectorAll('[data-revise]').forEach((btn) => btn.addEventListener('click', async () => {
    try { await clearMistake(btn.dataset.revise); toast('Marked as revised.'); ctx.rerender(); } catch (err) { toast(errText(err)); }
  }));
}

export function renderPastTopics(app, ctx) {
  const { S, data } = ctx;
  const topics = S.priv.flipCompleted.map((i) => ({ i, t: data.topics[i] })).filter((x) => x.t);
  app.innerHTML = `
  <div class="enter">
    <header class="page-head">
      <span class="label">Word Flip / Archive</span>
      <h1 class="pixel-title">Past Topics</h1>
      <span class="hand">study any time, no timer</span>
    </header>
    <section class="paper spiral">
      ${topics.length ? `<div class="polaroid-grid">${topics.map(({ i, t }) => `
        <a class="polaroid" href="#/topics/${i}">
          <div class="shot"><span class="term-small">${esc(t.cards[0] ? t.cards[0].term : t.title)}<br><small style="font-family:var(--font-body);font-size:.7rem;color:#6f6e69">+ ${Math.max(0, t.cards.length - 1)} more</small></span></div>
          <div class="caption">${i + 1}. ${esc(t.title)}</div>
        </a>`).join('')}</div>` : '<p class="muted">Finish a Word Flip quiz and its topic will be pinned here.</p>'}
    </section>
  </div>`;
}

export function renderTopicReview(app, ctx, index) {
  const { S, data } = ctx;
  const topic = data.topics[index];
  if (!topic || !S.priv.flipCompleted.includes(index)) {
    app.innerHTML = '<div class="paper notice"><p class="pixel-title">Topic not unlocked</p><p>Only topics you have completed can be studied here. <a href="#/topics">Past topics</a></p></div>';
    return;
  }
  app.innerHTML = `
  <div class="enter">
    <header class="page-head">
      <span class="label">Past topics / ${index + 1}</span>
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
    <p style="margin-top:24px"><a class="btn ghost" href="#/topics">← Past topics</a></p>
  </div>`;
}
