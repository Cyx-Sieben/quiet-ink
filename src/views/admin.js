/**
 * Admin: review reported pieces and comments.
 * To make yourself an admin, create a document admins/{your uid} in the Firebase console (see SETUP.md).
 */
import { collection, query, orderBy, limit, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { esc, toast, errText } from '../lib/ui.js';
import { stamp } from '../lib/week.js';

export async function renderAdmin(app, ctx) {
  const { S } = ctx;
  if (!S.isAdmin) {
    app.innerHTML = '<div class="paper notice"><p class="pixel-title">Admins only</p><p>This page is only for moderators.</p></div>';
    return;
  }
  app.innerHTML = `
  <div class="enter">
    <header class="page-head"><span class="label">Admin</span><h1 class="pixel-title">Reports</h1></header>
    <div id="abody"><p class="on-cloth">Loading...</p></div>
  </div>`;
  const body = document.getElementById('abody');
  try {
    const snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100)));
    const reports = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    body.innerHTML = reports.length ? `<div class="stack">${reports.map((r) => `
      <article class="paper plain" data-id="${esc(r.id)}">
        <div class="sticker-row"><span class="sticker red">${esc(r.type)}</span><span class="sticker peach">${esc(r.reason)}</span><span class="muted">${esc(stamp(r.createdAt))}</span></div>
        ${r.note ? `<p style="margin:10px 0 0">"${esc(r.note)}"</p>` : ''}
        <p class="muted" style="font-size:.8rem;margin:8px 0">Piece: <a href="#/p/${esc(r.pieceId)}">${esc(r.pieceId)}</a>${r.commentId ? ` · Comment: ${esc(r.commentId)}` : ''}</p>
        <div class="btn-row">
          <a class="btn ghost small" href="#/p/${esc(r.pieceId)}">Open</a>
          <button class="btn danger small" data-remove>Delete ${r.type === 'comment' ? 'comment' : 'piece'}</button>
          <button class="btn ghost small" data-dismiss>Dismiss report</button>
        </div>
      </article>`).join('')}</div>` : '<div class="paper notice"><span class="hand">no reports. All quiet.</span></div>';

    body.querySelectorAll('[data-dismiss]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.closest('[data-id]').dataset.id;
      try { await deleteDoc(doc(db, 'reports', id)); ctx.rerender(); } catch (err) { toast(errText(err)); }
    }));
    body.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.closest('[data-id]').dataset.id;
      const r = reports.find((x) => x.id === id);
      if (!window.confirm('Delete this content for everyone?')) return;
      try {
        if (r.type === 'comment') await deleteDoc(doc(db, 'pieces', r.pieceId, 'comments', r.commentId));
        else await deleteDoc(doc(db, 'pieces', r.pieceId));
        await deleteDoc(doc(db, 'reports', id));
        toast('Content removed.');
        ctx.rerender();
      } catch (err) { toast(errText(err)); }
    }));
  } catch (err) {
    body.innerHTML = `<div class="paper notice"><p>${esc(errText(err))}</p></div>`;
  }
}
