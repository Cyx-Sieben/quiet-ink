/**
 * Part 3: The Weekly Page.
 * Everyone gets the same concept each week. Write with no word limit, choose who can
 * read it, and publish. The text locks after publishing; visibility can still change.
 */
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { esc, countWords, toast, errText, ORN, flameBadge, readingTime } from '../lib/ui.js';
import { dayDate, nextWeek } from '../lib/week.js';
import { conceptOfWeek, POINTS, liveStreak } from '../lib/rules.js';
import { saveWeek, addPoints, completePart, pieceId } from '../lib/session.js';

export const VIS_LABEL = { public: 'Public', friends: 'Friends only', private: 'Private' };

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
    S.week.page = { conceptId: concept.id, title: '', draft: '', visibility: 'public', published: false, deleted: false, words: 0 };
  }
  const pg = S.week.page;
  const id = pieceId(S.user.uid, W);

  const intro = `
    ${conceptBand(concept, `Part three / The Weekly Page / ${esc(concept.field)}`)}
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
          ${pg.deleted ? '<span class="sticker red">Deleted</span>' : '<span class="sticker blue">✦ Published</span>'}
          <span class="sticker peach" style="--rot:2deg">${pg.words} words · ${readingTime(pg.words)}</span>
          ${flameBadge(liveStreak(S.profile.streaks.page, W), { label: 'Page' })}
        </div>
        <h2 class="piece-title">${esc(pg.title)}</h2>
        <div class="submitted-text">${esc(pg.draft)}</div>
        ${pg.deleted ? '<p class="muted">You deleted this piece. Your points and streak for this week are kept.</p>' : `
        <div class="btn-row" style="margin-top:22px">
          <a class="btn" href="#/p/${esc(id)}">Open public page</a>
          <label class="inline-field">Who can read it:
            <select id="vis">${Object.entries(VIS_LABEL).map(([k, v]) => `<option value="${k}" ${pg.visibility === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
          </label>
          <button class="btn ghost danger small" id="del">Delete piece</button>
        </div>`}
        <p class="muted" style="margin-top:18px">A new concept arrives on ${esc(dayDate(nextWeek(W)))}.</p>
      </section>
    </div>`;

    const vis = document.getElementById('vis');
    if (vis) vis.addEventListener('change', async () => {
      try {
        const v = vis.value;
        await updateDoc(doc(db, 'pieces', id), { visibility: v, friendIds: v === 'private' ? [] : S.priv.friendIds });
        pg.visibility = v;
        await saveWeek();
        toast(`Now visible to: ${VIS_LABEL[v]}.`);
      } catch (err) { toast(errText(err)); }
    });
    const del = document.getElementById('del');
    if (del) del.addEventListener('click', async () => {
      if (!window.confirm('Delete this piece from your profile and the Reading Room? This cannot be undone.')) return;
      try {
        await deleteDoc(doc(db, 'pieces', id));
        pg.deleted = true;
        await saveWeek();
        toast('Piece deleted.');
        ctx.rerender();
      } catch (err) { toast(errText(err)); }
    });
    return;
  }

  app.innerHTML = `
  <div class="enter">
    ${intro}
    <section>
      <div class="sticker-row" style="margin-bottom:16px">
        <span class="sticker peach">One piece this week</span>
        <span class="sticker mint" style="--rot:2deg">No word limit</span>
        <span class="sticker blue" style="--rot:-1deg">+${POINTS.pagePublished} pts when published</span>
        <span class="muted" id="saved" style="font-size:.85rem"></span>
      </div>
      <label class="visually-hidden" for="title">Title</label>
      <input id="title" class="title-input" maxlength="120" placeholder="Give your piece a title" value="${esc(pg.title)}">
      <div class="editor-wrap">
        <label for="editor" class="visually-hidden">Your piece</label>
        <textarea id="editor" class="editor lined" spellcheck="true" placeholder="Begin here. There is no rush.">${esc(pg.draft)}</textarea>
        <span class="wordcount" id="wc">0 words</span>
      </div>
      <div class="btn-row" style="margin-top:22px">
        <label class="inline-field on-cloth">Who can read it:
          <select id="vis">${Object.entries(VIS_LABEL).map(([k, v]) => `<option value="${k}" ${pg.visibility === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </label>
        <button class="btn" id="publish">Publish my page</button>
        <span class="hand" style="color:#fff">the text locks once published</span>
      </div>
    </section>
  </div>`;

  const title = document.getElementById('title');
  const editor = document.getElementById('editor');
  const wc = document.getElementById('wc');
  const saved = document.getElementById('saved');
  const visSel = document.getElementById('vis');
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
    pg.visibility = visSel.value;
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
  visSel.addEventListener('change', schedule);

  document.getElementById('publish').addEventListener('click', async () => {
    const text = editor.value.trim();
    const t = title.value.trim() || concept.name;
    const n = countWords(text);
    if (!n) { toast('Write something before you publish.'); editor.focus(); return; }
    if (!window.confirm(`Publish "${t}" (${n} words) as ${VIS_LABEL[visSel.value]}? You will not be able to edit the text.`)) return;
    const btn = document.getElementById('publish');
    btn.disabled = true;
    try {
      const v = visSel.value;
      await setDoc(doc(db, 'pieces', id), {
        uid: S.user.uid,
        authorNick: S.profile.nickname,
        authorAvatar: S.profile.avatar || 'ink',
        authorPhoto: S.profile.photoURL || null,
        title: t,
        text,
        words: n,
        conceptId: concept.id,
        conceptName: concept.name,
        weekKey: W,
        visibility: v,
        friendIds: v === 'private' ? [] : S.priv.friendIds,
        createdAt: serverTimestamp()
      });
      Object.assign(pg, { title: t, draft: text, words: n, visibility: v, published: true });
      clearTimeout(timer);
      await saveWeek();
      await addPoints('page', POINTS.pagePublished);
      await completePart('page');
      toast('Published. Your Weekly Page streak is safe this week.');
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
