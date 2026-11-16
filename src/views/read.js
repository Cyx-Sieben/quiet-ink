/**
 * The Reading Room: community writing with a Substack-style reading layout.
 * Tabs: This Week, Latest, Friends, Topics, Search. Pieces have likes, comments and reports.
 */
import {
  collection, doc, query, where, orderBy, limit, getDocs, getDoc, setDoc, deleteDoc,
  addDoc, getCountFromServer, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { esc, toast, errText, avatarHtml, readingTime } from '../lib/ui.js';
import { stamp, weekKey } from '../lib/week.js';
import { conceptOfWeek } from '../lib/rules.js';
import { addToList } from '../lib/session.js';
import { VIS_LABEL, conceptBand } from './page.js';

const TABS = [
  ['week', 'This Week'],
  ['latest', 'Latest'],
  ['friends', 'Friends'],
  ['topics', 'Topics'],
  ['search', 'Search']
];

const piecesCol = () => collection(db, 'pieces');

function visibleFilter(S) {
  const hidden = new Set((S.priv && S.priv.hidden) || []);
  const blocked = new Set((S.priv && S.priv.blocked) || []);
  return (p) => !hidden.has(p.id) && !blocked.has(p.uid);
}

function excerpt(text, n = 220) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')}...` : t;
}

export function pieceCard(p, { showAuthor = true } = {}) {
  return `
  <article class="piece-card">
    <a class="piece-link" href="#/p/${esc(p.id)}">
      <span class="sticker lilac piece-concept">${esc(p.conceptName)}</span>
      <h3 class="piece-card-title">${esc(p.title)}</h3>
      <p class="piece-excerpt">${esc(excerpt(p.text))}</p>
    </a>
    <div class="byline">
      ${showAuthor ? `<a class="byline-author" href="#/@${esc(p.authorNick)}">${avatarHtml({ avatar: p.authorAvatar, photoURL: p.authorPhoto }, 28)}<span>${esc(p.authorNick)}</span></a>` : ''}
      <span class="muted">${esc(stamp(p.createdAt))} · ${readingTime(p.words)}</span>
      ${p.visibility !== 'public' ? `<span class="sticker ink" style="--rot:0deg">${VIS_LABEL[p.visibility]}</span>` : ''}
    </div>
  </article>`;
}

function rows(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function list(items, empty) {
  return items.length ? `<div class="piece-list">${items.map((p) => pieceCard(p)).join('')}</div>` : `<div class="paper plain notice"><span class="hand">${empty}</span></div>`;
}

export async function renderReadingRoom(app, ctx, tab) {
  const { S, data } = ctx;
  const W = S.weekKey || weekKey();
  const concept = conceptOfWeek(data.prompts, W);
  const keep = visibleFilter(S);

  app.innerHTML = `
  <div class="enter reading-room">
    <header class="page-head">
      <span class="label">Community</span>
      <h1 class="pixel-title">The Reading Room</h1>
      <span class="hand">pages from writers like you</span>
      <nav class="tabs" aria-label="Reading Room sections">
        ${TABS.map(([k, v]) => `<a href="#/read/${k}" class="tab ${k === tab ? 'on' : ''}" ${k === tab ? 'aria-current="page"' : ''}>${v}</a>`).join('')}
      </nav>
    </header>
    <div id="rr-body" class="reading-column"><p class="muted on-cloth">Loading...</p></div>
  </div>`;
  const body = document.getElementById('rr-body');

  try {
    if (tab === 'week') {
      const snap = await getDocs(query(piecesCol(), where('visibility', '==', 'public'), where('weekKey', '==', W), orderBy('createdAt', 'desc'), limit(60)));
      body.innerHTML = `
        ${concept ? `<div class="paper plain week-concept"><span class="label">This week's concept</span><h2 class="serif" style="font-size:2rem;margin:4px 0">${esc(concept.name)}</h2><p class="muted" style="margin:0">${esc(concept.explanation)}</p></div>` : ''}
        ${list(rows(snap).filter(keep), 'no pages yet this week. Be the first!')}`;
    } else if (tab === 'latest') {
      const snap = await getDocs(query(piecesCol(), where('visibility', '==', 'public'), orderBy('createdAt', 'desc'), limit(60)));
      body.innerHTML = list(rows(snap).filter(keep), 'nothing published yet');
    } else if (tab === 'friends') {
      if (!S.profile) {
        body.innerHTML = '<div class="paper plain notice"><p>Sign in to read pages from your friends.</p><button class="btn" id="rr-signin">Sign in with Google</button></div>';
        document.getElementById('rr-signin').addEventListener('click', ctx.signIn);
        return;
      }
      const snap = await getDocs(query(piecesCol(), where('friendIds', 'array-contains', S.user.uid), where('visibility', 'in', ['public', 'friends']), orderBy('createdAt', 'desc'), limit(60)));
      body.innerHTML = list(rows(snap).filter(keep), 'add friends to see their pages here');
    } else if (tab === 'topics') {
      const sorted = data.prompts.slice().sort((a, b) => a.name.localeCompare(b.name));
      body.innerHTML = `
        <div class="topic-grid">
          ${sorted.map((p) => `<a class="topic-chip ${concept && p.id === concept.id ? 'now' : ''}" href="#/read/topic/${esc(p.id)}"><strong>${esc(p.name)}</strong><span>${esc(p.field)}</span></a>`).join('')}
        </div>`;
    } else if (tab === 'search') {
      renderSearch(body, ctx, keep);
    }
  } catch (err) {
    body.innerHTML = `<div class="paper plain notice"><p>${esc(errText(err))}</p></div>`;
  }
}

function renderSearch(body, ctx, keep) {
  const { data } = ctx;
  body.innerHTML = `
    <form class="paper plain search-box" id="sform" role="search">
      <label class="visually-hidden" for="sq">Search</label>
      <input id="sq" type="search" placeholder="Search titles, concepts, writers or words" autocomplete="off">
      <button class="btn" type="submit">Search</button>
    </form>
    <div id="sres"></div>`;
  const input = document.getElementById('sq');
  input.focus();
  document.getElementById('sform').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = input.value.trim().toLowerCase();
    const out = document.getElementById('sres');
    if (q.length < 2) { out.innerHTML = '<p class="on-cloth">Type at least 2 characters.</p>'; return; }
    out.innerHTML = '<p class="on-cloth">Searching...</p>';
    try {
      const [pieceSnap, userSnap] = await Promise.all([
        getDocs(query(piecesCol(), where('visibility', '==', 'public'), orderBy('createdAt', 'desc'), limit(300))),
        getDocs(query(collection(db, 'users'), where('nicknameLower', '>=', q), where('nicknameLower', '<', `${q}`), limit(8)))
      ]);
      const pieces = rows(pieceSnap).filter(keep).filter((p) =>
        [p.title, p.conceptName, p.authorNick, p.text].some((f) => String(f || '').toLowerCase().includes(q)));
      const people = userSnap.docs.map((d) => d.data());
      const concepts = data.prompts.filter((p) => (p.name + ' ' + p.field).toLowerCase().includes(q));
      out.innerHTML = `
        ${concepts.length ? `<h2 class="label on-cloth section-label">Topics</h2><div class="topic-grid">${concepts.map((p) => `<a class="topic-chip" href="#/read/topic/${esc(p.id)}"><strong>${esc(p.name)}</strong><span>${esc(p.field)}</span></a>`).join('')}</div>` : ''}
        ${people.length ? `<h2 class="label on-cloth section-label">Writers</h2><div class="people-row">${people.map((u) => `<a class="person-chip" href="#/@${esc(u.nickname)}">${avatarHtml(u, 30)}<span>${esc(u.nickname)}</span></a>`).join('')}</div>` : ''}
        <h2 class="label on-cloth section-label">Pages (${pieces.length})</h2>
        ${list(pieces, 'no pages match your search')}
        <p class="on-cloth" style="font-size:.8rem">Search looks through the 300 most recent public pages.</p>`;
    } catch (err) {
      out.innerHTML = `<div class="paper plain notice"><p>${esc(errText(err))}</p></div>`;
    }
  });
}

export async function renderTopic(app, ctx, conceptId) {
  const { S, data } = ctx;
  const concept = data.prompts.find((p) => p.id === conceptId);
  if (!concept) { app.innerHTML = '<div class="paper notice"><p>Topic not found. <a href="#/read/topics">All topics</a></p></div>'; return; }
  app.innerHTML = `
  <div class="enter">
    ${conceptBand(concept, `Reading Room / Topic / ${esc(concept.field)}`)}
    <div class="reading-column">
      <div class="paper plain" style="margin-bottom:24px"><p class="lead" style="margin:0">${esc(concept.explanation)}</p></div>
      <div id="tbody"><p class="on-cloth">Loading...</p></div>
      <p style="margin-top:20px"><a class="btn ghost" href="#/read/topics">← All topics</a></p>
    </div>
  </div>`;
  try {
    const snap = await getDocs(query(piecesCol(), where('visibility', '==', 'public'), where('conceptId', '==', conceptId), orderBy('createdAt', 'desc'), limit(60)));
    document.getElementById('tbody').innerHTML = list(rows(snap).filter(visibleFilter(S)), 'no pages on this topic yet');
  } catch (err) {
    document.getElementById('tbody').innerHTML = `<div class="paper plain notice"><p>${esc(errText(err))}</p></div>`;
  }
}

function paragraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((para) => `<p>${esc(para.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

const REASONS = ['Spam or advertising', 'Harassment or bullying', 'Hateful or violent content', 'Copied from someone else', 'Sexual content', 'Something else'];

function reportForm(id) {
  return `<form class="report-form paper plain" id="${id}" hidden>
    <label class="field"><span class="label">Why are you reporting this?</span>
      <select name="reason">${REASONS.map((r) => `<option>${r}</option>`).join('')}</select></label>
    <label class="field"><span class="label">Details (optional)</span><input name="note" maxlength="300"></label>
    <div class="btn-row"><button class="btn danger small" type="submit">Send report</button><button class="btn ghost small" type="button" data-cancel>Cancel</button></div>
  </form>`;
}

async function sendReport(S, payload) {
  await addDoc(collection(db, 'reports'), { ...payload, reporterUid: S.user.uid, createdAt: serverTimestamp() });
}

export async function renderPiece(app, ctx, id) {
  const { S } = ctx;
  let p;
  try {
    const snap = await getDoc(doc(db, 'pieces', id));
    if (!snap.exists()) throw new Error('missing');
    p = { id: snap.id, ...snap.data() };
  } catch (err) {
    app.innerHTML = '<div class="paper notice"><p class="pixel-title">Page not available</p><p>It may have been deleted, or it is only visible to the writer\'s friends.</p><p><a href="#/read">Back to the Reading Room</a></p></div>';
    return;
  }
  const me = S.user && S.user.uid;
  const mine = me === p.uid;
  const canModerate = mine || S.isAdmin;

  app.innerHTML = `
  <div class="enter">
    <article class="reader paper plain">
      <span class="sticker lilac">${esc(p.conceptName)}</span>
      ${p.visibility !== 'public' ? `<span class="sticker ink" style="--rot:2deg">${VIS_LABEL[p.visibility]}</span>` : ''}
      <h1 class="reader-title">${esc(p.title)}</h1>
      <div class="byline big">
        <a class="byline-author" href="#/@${esc(p.authorNick)}">${avatarHtml({ avatar: p.authorAvatar, photoURL: p.authorPhoto }, 40)}<span>${esc(p.authorNick)}</span></a>
        <span class="muted">${esc(stamp(p.createdAt))} · ${p.words} words · ${readingTime(p.words)}</span>
      </div>
      <hr class="rule">
      <div class="reader-body">${paragraphs(p.text)}</div>
      <hr class="rule">
      <div class="btn-row reader-actions">
        <button class="btn ghost small like-btn" id="like" ${me ? '' : 'disabled title="Sign in to like"'}>♥ <span id="like-n">0</span></button>
        <a class="btn ghost small" href="#/read/topic/${esc(p.conceptId)}">More on ${esc(p.conceptName)}</a>
        ${mine ? '<a class="btn ghost small" href="#/page">Manage</a>' : ''}
        ${me && !mine ? '<button class="btn ghost small" id="report-piece">Report</button>' : ''}
        ${S.isAdmin && !mine ? '<button class="btn danger small" id="admin-del">Delete (admin)</button>' : ''}
      </div>
      ${reportForm('rp-form')}
    </article>

    <section class="reader paper plain comments">
      <h2 class="label">Comments</h2>
      <div id="clist"><p class="muted">Loading...</p></div>
      ${me ? `<form id="cform" class="comment-form">
        <label class="visually-hidden" for="ctext">Write a comment</label>
        <textarea id="ctext" rows="3" maxlength="1000" placeholder="Leave a kind, thoughtful comment"></textarea>
        <button class="btn small" type="submit">Post comment</button>
      </form>` : '<p class="muted">Sign in to join the conversation.</p>'}
    </section>
  </div>`;

  const likesCol = collection(db, 'pieces', id, 'likes');
  async function refreshLikes() {
    try {
      const c = await getCountFromServer(likesCol);
      document.getElementById('like-n').textContent = c.data().count;
      if (me) {
        const mineLike = await getDoc(doc(db, 'pieces', id, 'likes', me));
        document.getElementById('like').classList.toggle('on', mineLike.exists());
      }
    } catch (e) { /* likes are optional */ }
  }
  refreshLikes();

  const likeBtn = document.getElementById('like');
  if (me) likeBtn.addEventListener('click', async () => {
    const ref = doc(db, 'pieces', id, 'likes', me);
    try {
      if (likeBtn.classList.contains('on')) await deleteDoc(ref);
      else await setDoc(ref, { uid: me, createdAt: serverTimestamp() });
      refreshLikes();
    } catch (err) { toast(errText(err)); }
  });

  // Report the piece
  const rpBtn = document.getElementById('report-piece');
  const rpForm = document.getElementById('rp-form');
  if (rpBtn) {
    rpBtn.addEventListener('click', () => { rpForm.hidden = false; });
    rpForm.querySelector('[data-cancel]').addEventListener('click', () => { rpForm.hidden = true; });
    rpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await sendReport(S, { type: 'piece', pieceId: id, commentId: null, reason: rpForm.reason.value, note: rpForm.note.value.slice(0, 300), targetUid: p.uid });
        await addToList('hidden', id);
        toast('Thank you. The report was sent and this page is now hidden for you.');
        ctx.go('#/read');
      } catch (err) { toast(errText(err)); }
    });
  }

  const adminDel = document.getElementById('admin-del');
  if (adminDel) adminDel.addEventListener('click', async () => {
    if (!window.confirm('Delete this piece for everyone?')) return;
    try { await deleteDoc(doc(db, 'pieces', id)); toast('Deleted.'); ctx.go('#/read'); } catch (err) { toast(errText(err)); }
  });

  // Comments
  const commentsCol = collection(db, 'pieces', id, 'comments');
  async function loadComments() {
    const box = document.getElementById('clist');
    try {
      const snap = await getDocs(query(commentsCol, orderBy('createdAt', 'asc'), limit(200)));
      const hiddenC = new Set((S.priv && S.priv.hiddenComments) || []);
      const blocked = new Set((S.priv && S.priv.blocked) || []);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !hiddenC.has(c.id) && !blocked.has(c.uid));
      box.innerHTML = items.length ? items.map((c) => `
        <div class="comment" data-id="${esc(c.id)}">
          <a class="byline-author" href="#/@${esc(c.nick)}">${avatarHtml({ avatar: c.avatar, photoURL: c.photo }, 26)}<span>${esc(c.nick)}</span></a>
          <span class="muted" style="font-size:.78rem">${esc(stamp(c.createdAt))}</span>
          <p>${esc(c.text).replace(/\n/g, '<br>')}</p>
          <div class="comment-actions">
            ${me && (c.uid === me || canModerate) ? '<button class="linklike" data-del>Delete</button>' : ''}
            ${me && c.uid !== me ? '<button class="linklike" data-rep>Report</button>' : ''}
          </div>
        </div>`).join('') : '<p class="muted">No comments yet.</p>';

      box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
        const cid = b.closest('.comment').dataset.id;
        if (!window.confirm('Delete this comment?')) return;
        try { await deleteDoc(doc(db, 'pieces', id, 'comments', cid)); loadComments(); } catch (err) { toast(errText(err)); }
      }));
      box.querySelectorAll('[data-rep]').forEach((b) => b.addEventListener('click', async () => {
        const el = b.closest('.comment');
        const cid = el.dataset.id;
        const reason = window.prompt(`Why are you reporting this comment?\n${REASONS.map((r, i) => `${i + 1}. ${r}`).join('\n')}\nType a number:`, '1');
        if (!reason) return;
        const r = REASONS[Number(reason) - 1] || REASONS[REASONS.length - 1];
        const c = items.find((x) => x.id === cid);
        try {
          await sendReport(S, { type: 'comment', pieceId: id, commentId: cid, reason: r, note: '', targetUid: c ? c.uid : null });
          await addToList('hiddenComments', cid);
          toast('Report sent. The comment is hidden for you.');
          loadComments();
        } catch (err) { toast(errText(err)); }
      }));
    } catch (err) {
      box.innerHTML = `<p class="muted">${esc(errText(err))}</p>`;
    }
  }
  loadComments();

  const cform = document.getElementById('cform');
  if (cform) cform.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ta = document.getElementById('ctext');
    const text = ta.value.trim();
    if (!text) return;
    try {
      await addDoc(commentsCol, {
        uid: me, nick: S.profile.nickname, avatar: S.profile.avatar || 'ink', photo: S.profile.photoURL || null,
        text: text.slice(0, 1000), createdAt: serverTimestamp()
      });
      ta.value = '';
      loadComments();
    } catch (err) { toast(errText(err)); }
  });
}
