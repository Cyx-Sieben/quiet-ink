/**
 * The Newsstand: essays and articles from public feeds around the web.
 * Shows titles and short excerpts only; "Read on original site" opens the source.
 */
import { esc } from '../lib/ui.js';
import { stamp } from '../lib/week.js';

let cache = null;

export async function renderNewsstand(app) {
  app.innerHTML = `
  <div class="enter">
    <header class="page-head">
      <span class="label">Outside reading</span>
      <h1 class="pixel-title">The Newsstand</h1>
      <span class="hand">good writing from around the web</span>
      <p class="lead">Fresh essays, journals and articles from newsletters and magazines. Read the opening here, then continue on the writer's own site.</p>
      <form class="search-inline" id="nform" role="search" style="margin-top:10px">
        <label class="visually-hidden" for="nq">Filter articles</label>
        <input id="nq" type="search" placeholder="Filter by title, publication or words" autocomplete="off">
      </form>
      <nav class="tabs small" id="ntopics" aria-label="Topics"></nav>
    </header>
    <div class="reading-column" id="nbody"><p class="on-cloth">Collecting today's papers...</p></div>
  </div>`;

  const body = document.getElementById('nbody');
  try {
    if (!cache || Date.now() - cache.at > 10 * 60 * 1000) {
      const res = await fetch('/api/newsstand');
      if (!res.ok) throw new Error(`The Newsstand service answered ${res.status}.`);
      cache = { at: Date.now(), data: await res.json() };
    }
  } catch (err) {
    body.innerHTML = `<div class="paper plain notice"><p class="pixel-title" style="font-size:1.5rem">The Newsstand is closed</p><p>${esc(err.message)}</p><p class="muted">The Newsstand needs the /api/newsstand function, which runs on Vercel or with "npm run dev". It does not run on GitHub Pages.</p></div>`;
    return;
  }

  const { items, failed } = cache.data;
  const topics = ['All', ...Array.from(new Set(items.map((i) => i.topic))).sort()];
  let topic = 'All';
  let q = '';

  const nt = document.getElementById('ntopics');
  nt.innerHTML = topics.map((t) => `<button class="tab ${t === 'All' ? 'on' : ''}" data-topic="${esc(t)}">${esc(t)}</button>`).join('');

  function draw() {
    const filtered = items.filter((i) => (topic === 'All' || i.topic === topic)
      && (!q || [i.title, i.publication, i.excerpt, i.author].some((f) => String(f || '').toLowerCase().includes(q))));
    body.innerHTML = `
      ${filtered.length ? `<div class="piece-list">${filtered.map((i) => `
        <article class="piece-card news-card">
          <span class="sticker peach piece-concept">${esc(i.publication)}</span>
          <h3 class="piece-card-title">${esc(i.title)}</h3>
          ${i.excerpt ? `<p class="piece-excerpt">${esc(i.excerpt)}</p>` : ''}
          <div class="byline">
            <span class="muted">${i.author ? `${esc(i.author)} · ` : ''}${i.date ? esc(stamp(i.date)) : ''}</span>
            <a class="btn small" href="${esc(i.link)}" target="_blank" rel="noopener noreferrer">Read on original site ↗</a>
          </div>
        </article>`).join('')}</div>` : `<div class="paper plain notice"><span class="hand">${items.length ? 'nothing matches' : 'no articles could be loaded right now'}</span></div>`}
      ${failed && failed.length ? `<p class="on-cloth" style="font-size:.8rem;margin-top:18px">Could not load: ${failed.map((f) => esc(f.name)).join(', ')}. Check these feed addresses in public/data/newsstand_feeds.json.</p>` : ''}`;
  }

  nt.querySelectorAll('[data-topic]').forEach((b) => b.addEventListener('click', () => {
    topic = b.dataset.topic;
    nt.querySelectorAll('[data-topic]').forEach((x) => x.classList.toggle('on', x === b));
    draw();
  }));
  document.getElementById('nq').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
  document.getElementById('nform').addEventListener('submit', (e) => e.preventDefault());
  draw();
}
