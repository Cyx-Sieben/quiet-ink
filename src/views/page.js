/**
 * Part 5: The Weekly Page.
 * Everyone gets the same concept each week. Write with no word limit, then
 * "Finish & Save" — your page stays private in your own record. Export it to
 * Google Docs (or download a .docx) any time, and publish it anywhere you like.
 */
import { esc, countWords, toast, errText, ORN, flameBadge, readingTime } from '../lib/ui.js';
import { now } from '../lib/clock.js';
import { dayDate, nextWeek } from '../lib/week.js';
import { conceptOfWeek, POINTS, liveStreak } from '../lib/rules.js';
import { MOCK } from '../firebase.js';
import { saveWeek, addPoints, completePart, pastPages } from '../lib/session.js';
import { exportToGoogleDocs, downloadDocx } from '../lib/docs.js';

export function conceptBand(concept, label) {
  return `
    <section class="band torn-both concept-head">
      <div class="band-inner">
        <span class="label">${label}</span>
        <h1 class="band-giant">${esc(concept.name)}</h1>
        <span class="ornaments" style="color:var(--band-ink)" aria-hidden="true">✸ ✦ ♣</span>
      </div>
    </section>`;
}

export async function renderWrite(app, ctx) {
  const { S, data } = ctx;
  const W = S.weekKey;
  const concept = conceptOfWeek(data.prompts, W);
  if (!concept) {
    app.innerHTML = '<div class="paper notice"><p class="pixel-title">No concepts found</p><p>Add concepts to public/data/writing_prompts.json.</p></div>';
    return;
  }
  if (!S.week.page) {
    S.week.page = { conceptId: concept.id, title: '', draft: '', published: false, words: 0 };
  }
  const pg = S.week.page;

  const intro = `
    ${conceptBand(concept, `Part five / The Weekly Page / ${esc(concept.field)}`)}
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

  if (pg.published) {
    app.innerHTML = `
    <div class="enter">
      ${intro}
      <section class="paper spiral">
        <div class="sticker-row" style="margin-bottom:14px">
          <span class="sticker blue">✦ Finished this week</span>
          <span class="sticker peach" style="--rot:2deg">${pg.words} words · ${readingTime(pg.words)}</span>
          ${flameBadge(liveStreak(S.profile.streaks.page, W), { label: 'Page' })}
        </div>
        <h2 class="piece-title">${esc(pg.title)}</h2>
        <div class="submitted-text">${esc(pg.draft)}</div>
        <div class="btn-row" style="margin-top:22px">
          <button class="btn" id="gdoc">Save to Google Docs</button>
          <button class="btn ghost" id="docx">Download .docx</button>
        </div>
        <p class="muted" style="margin-top:18px">Your page is saved privately to your account. Export it and publish it anywhere you like — it's yours. A new concept arrives on ${esc(dayDate(nextWeek(W)))}.</p>
      </section>
      ${await shelfHtml(ctx)}
    </div>`;
    wireExport(app, ctx, { title: pg.title, draft: pg.draft, concept });
    return;
  }

  app.innerHTML = `
  <div class="enter">
    ${intro}
    <section>
      <div class="sticker-row" style="margin-bottom:16px">
        <span class="sticker peach">One page this week</span>
        <span class="sticker mint" style="--rot:2deg">No word limit</span>
        <span class="sticker blue" style="--rot:-1deg">+${POINTS.pageFinished} pts when finished</span>
        <span class="muted" id="saved" style="font-size:.85rem"></span>
      </div>
      <label class="visually-hidden" for="title">Title</label>
      <input id="title" class="title-input" maxlength="120" placeholder="Give your piece a title" value="${esc(pg.title)}">
      <div class="editor-wrap">
        <label for="editor" class="visually-hidden">Your piece</label>
        <textarea id="editor" class="editor lined" spellcheck="true" placeholder="Begin here. There is no rush, and no limit.">${esc(pg.draft)}</textarea>
        <span class="wordcount" id="wc">0 words</span>
      </div>
      <div class="btn-row" style="margin-top:22px">
        <button class="btn" id="finish">Finish my page</button>
        <span class="hand" style="color:#fff">it saves to your private shelf — export anytime</span>
      </div>
    </section>
  </div>`;

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
    pg.title = title.value;
    pg.draft = editor.value;
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

  document.getElementById('finish').addEventListener('click', async () => {
    const text = editor.value.trim();
    const t = title.value.trim() || concept.name;
    const n = countWords(text);
    if (!n) { toast('Write something before you finish.'); editor.focus(); return; }
    if (!window.confirm(`Finish "${t}" (${n} words)? It saves to your private shelf — you can export it to Google Docs anytime.`)) return;
    const btn = document.getElementById('finish');
    btn.disabled = true;
    try {
      Object.assign(pg, { title: t, draft: text, words: n, published: true, finishedAt: now() });
      clearTimeout(timer);
      await saveWeek();
      await addPoints('page', POINTS.pageFinished);
      await completePart('page');
      toast('Your page is saved to your shelf. Your Weekly Page streak is safe this week.');
      ctx.rerender();
    } catch (err) {
      btn.disabled = false;
      toast(errText(err));
    }
  });

  count();
  return () => {
    if (timer && dirty) { clearTimeout(timer); saveDraft(); }
  };
}

/* ---------------------------------------------------------- My Shelf */
async function shelfHtml(ctx) {
  const { S } = ctx;
  let pages = [];
  try { pages = await pastPages(); } catch (err) { /* shelf is optional */ }
  const rows = pages
    .filter((p) => p.weekKey !== S.weekKey)
    .slice(0, 30)
    .map((p) => `
    <div class="shelf-item">
      <span class="sticker lilac">${esc(p.weekKey)}</span>
      <strong>${esc(p.title || 'Untitled')}</strong>
      <span class="muted" style="font-size:.85rem">${p.words || countWords(p.draft)} words</span>
      <span class="btn-row">
        <button class="btn ghost small" data-gdoc="${esc(p.weekKey)}">Google Doc</button>
        <button class="btn ghost small" data-docx="${esc(p.weekKey)}">.docx</button>
      </span>
    </div>`).join('');
  return `
  <section class="paper plain" style="margin-top:30px">
    <span class="label">My shelf — every page you've finished</span>
    ${rows ? `<div class="stack" style="margin-top:12px">${rows}</div>` : '<p class="muted" style="margin-top:8px">Your finished pages will collect here, week by week.</p>'}
  </section>`;
}

function wireExport(app, ctx, current) {
  const { S, data } = ctx;
  const byKey = {};
  const conceptFor = (conceptId) => (data.prompts || []).find((p) => p.id === conceptId);

  const doExport = async (mode, page) => {
    const concept = conceptFor(page.conceptId) || { name: 'Quiet Ink' };
    try {
      if (mode === 'gdoc') {
        if (MOCK) { toast('Mock mode: downloading a .docx instead (Google Docs needs real sign-in).'); return downloadDocx(page, concept); }
        await exportToGoogleDocs(page, concept);
        toast('Saved to Google Docs — opening it in a new tab.');
      } else {
        downloadDocx(page, concept);
        toast('Downloaded .docx — upload it to Google Docs anywhere.');
      }
    } catch (err) { toast(errText(err)); }
  };

  document.getElementById('gdoc').addEventListener('click', () => doExport('gdoc', current));
  document.getElementById('docx').addEventListener('click', () => doExport('docx', current));
  app.querySelectorAll('[data-gdoc]').forEach(async (b) => {
    const wk = b.dataset.gdoc;
    const page = (await pastPages()).find((p) => p.weekKey === wk);
    if (page) b.addEventListener('click', () => doExport('gdoc', page));
  });
  app.querySelectorAll('[data-docx]').forEach(async (b) => {
    const wk = b.dataset.docx;
    const page = (await pastPages()).find((p) => p.weekKey === wk);
    if (page) b.addEventListener('click', () => doExport('docx', page));
  });
}
