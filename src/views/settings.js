/**
 * Settings: profile, theme, data download, import from Version 1, sign out and account deletion.
 */
import {
  collection, collectionGroup, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, serverTimestamp
} from 'firebase/firestore';
import { deleteUser, reauthenticateWithPopup, signOut } from 'firebase/auth';
import { db, auth, googleProvider } from '../firebase.js';
import { esc, toast, errText, AVATARS, avatarSvg, avatarHtml, countWords } from '../lib/ui.js';
import {
  S, NICK_RE, changeNickname, updateProfile, updatePriv, userRef, privRef, pieceId, saveWeek
} from '../lib/session.js';

const V1_KEY = 'quietink.v1';
const THEME_KEY = 'quietink.theme';

function getTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { return 'auto'; }
}
function setTheme(t) {
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
  else root.removeAttribute('data-theme');
  try { if (t === 'auto') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, t); } catch (e) { /* ignore */ }
}

/* ------------------------------------------------------------ Version 1 import */
function readV1() {
  try { return JSON.parse(localStorage.getItem(V1_KEY) || 'null'); } catch (e) { return null; }
}

export function hasV1Progress() {
  const v1 = readV1();
  return Boolean(v1 && v1.version === 1 && S.priv && !S.priv.v1Imported);
}

export async function importV1Progress(v1 = readV1()) {
  if (!v1 || v1.version !== 1) throw new Error('No Version 1 progress found.');
  const correct = Array.from(new Set([...(S.priv.grammarCorrect || []), ...((v1.grammar && v1.grammar.correct) || [])]));
  const mistakes = { ...(S.priv.mistakes || {}) };
  Object.entries((v1.grammar && v1.grammar.mistakes) || {}).forEach(([id, m]) => {
    mistakes[id] = { count: m.count || 1, last: Date.parse(m.last) || Date.now(), choice: m.choice || null };
  });
  const flips = Array.from(new Set([...(S.priv.flipCompleted || []), ...((v1.flash && v1.flash.completed) || [])])).sort((a, b) => a - b);
  await updatePriv({ grammarCorrect: correct, mistakes, flipCompleted: flips, v1Imported: true });
  Object.assign(S.priv, { grammarCorrect: correct, mistakes, flipCompleted: flips, v1Imported: true });

  // Old reflections become private pieces on the profile.
  const prompts = S.data.prompts;
  let imported = 0;
  for (const [wk, w] of Object.entries(v1.weeks || {})) {
    const r = w.reflection;
    if (!r || !r.submitted || !r.text) continue;
    const id = pieceId(S.user.uid, wk);
    if (wk === S.weekKey && S.week && S.week.page && S.week.page.published) continue; // already published this week
    const exists = await getDoc(doc(db, 'pieces', id)).catch(() => null);
    if (exists && exists.exists()) continue;
    const concept = prompts.find((p) => p.id === r.id);
    await setDoc(doc(db, 'pieces', id), {
      uid: S.user.uid, authorNick: S.profile.nickname, authorAvatar: S.profile.avatar || 'ink', authorPhoto: S.profile.photoURL || null,
      title: concept ? concept.name : 'Reflection', text: r.text, words: countWords(r.text),
      conceptId: concept ? concept.id : 'w000', conceptName: concept ? concept.name : 'Reflection',
      weekKey: wk, visibility: 'private', friendIds: [], createdAt: serverTimestamp()
    });
    if (wk === S.weekKey && S.week) {
      // A Version 1 reflection from this week counts as this week's page (no extra points).
      S.week.page = { conceptId: concept ? concept.id : 'w000', title: concept ? concept.name : 'Reflection', draft: r.text, words: countWords(r.text), visibility: 'private', published: true, deleted: false, imported: true };
      await saveWeek();
    }
    imported += 1;
  }
  toast(`Imported earlier progress${imported ? ` and ${imported} reflection${imported > 1 ? 's' : ''} (kept private)` : ''}.`);
}

/* ------------------------------------------------------------ data download */
async function downloadMyData() {
  const uid = S.user.uid;
  const [profile, priv, weeks, pieces] = await Promise.all([
    getDoc(userRef()), getDoc(privRef()),
    getDocs(collection(db, 'users', uid, 'weeks')),
    getDocs(query(collection(db, 'pieces'), where('uid', '==', uid)))
  ]);
  const ts = (v) => JSON.parse(JSON.stringify(v, (k, x) => (x && typeof x.toMillis === 'function' ? new Date(x.toMillis()).toISOString() : x)));
  const out = {
    exportedAt: new Date().toISOString(),
    profile: ts(profile.data()),
    progress: ts(priv.data()),
    weeks: Object.fromEntries(weeks.docs.map((d) => [d.id, ts(d.data())])),
    pieces: pieces.docs.map((d) => ({ id: d.id, ...ts(d.data()) }))
  };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `quiet-ink-${S.profile.nickname}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------ account deletion */
async function deleteEverything(progress) {
  const uid = S.user.uid;
  const del = async (ref) => { try { await deleteDoc(ref); } catch (e) { /* keep going */ } };
  const docsOf = async (q) => { try { return (await getDocs(q)).docs; } catch (e) { return []; } };

  progress('Deleting your pages...');
  for (const p of await docsOf(query(collection(db, 'pieces'), where('uid', '==', uid)))) {
    for (const c of await docsOf(collection(db, 'pieces', p.id, 'comments'))) await del(c.ref);
    for (const l of await docsOf(collection(db, 'pieces', p.id, 'likes'))) await del(l.ref);
    await del(p.ref);
  }
  progress('Deleting your comments and likes...');
  for (const c of await docsOf(query(collectionGroup(db, 'comments'), where('uid', '==', uid)))) await del(c.ref);
  for (const l of await docsOf(query(collectionGroup(db, 'likes'), where('uid', '==', uid)))) await del(l.ref);

  progress('Removing friends...');
  for (const f of await docsOf(query(collection(db, 'friendships'), where('members', 'array-contains', uid)))) await del(f.ref);
  for (const r of await docsOf(query(collection(db, 'friendRequests'), where('from', '==', uid)))) await del(r.ref);
  for (const r of await docsOf(query(collection(db, 'friendRequests'), where('to', '==', uid)))) await del(r.ref);

  progress('Deleting your progress...');
  for (const w of await docsOf(collection(db, 'users', uid, 'weeks'))) await del(w.ref);
  await del(doc(db, 'users', uid, 'private', 'state'));
  await del(doc(db, 'users', uid, 'private', 'clock'));
  await del(doc(db, 'usernames', S.profile.nicknameLower));
  await del(doc(db, 'users', uid));

  progress('Deleting your sign-in...');
  try {
    await deleteUser(auth.currentUser);
  } catch (err) {
    if (String(err.code).includes('requires-recent-login')) {
      await reauthenticateWithPopup(auth.currentUser, googleProvider);
      await deleteUser(auth.currentUser);
    } else {
      await signOut(auth);
    }
  }
}

/* ------------------------------------------------------------ page */
export function renderSettings(app, ctx) {
  const p = S.profile;
  let avatar = p.avatar || 'ink';
  const theme = getTheme();

  app.innerHTML = `
  <div class="enter">
    <header class="page-head">
      <span class="label">Settings</span>
      <h1 class="pixel-title">Desk Drawer</h1>
      <span class="hand">profile, backups and privacy</span>
    </header>
    <div class="stack">
      <form class="paper plain stack" id="pform" novalidate>
        <span class="label">Profile</span>
        <label class="field"><span class="label">Nickname</span><input id="nick" maxlength="20" value="${esc(p.nickname)}"></label>
        <label class="field"><span class="label">Bio</span><textarea id="bio" maxlength="160" rows="2">${esc(p.bio || '')}</textarea></label>
        <fieldset class="field"><legend class="label">Avatar</legend>
          <div class="avatar-picker">
            ${p.photoURL ? `<button type="button" class="av-opt" data-av="google" aria-label="My Google photo">${avatarHtml({ avatar: 'google', photoURL: p.photoURL }, 52)}</button>` : ''}
            ${AVATARS.map((a) => `<button type="button" class="av-opt" data-av="${a}" aria-label="${a} avatar">${avatarSvg(a, 52)}</button>`).join('')}
          </div>
        </fieldset>
        <div class="btn-row"><button class="btn" type="submit">Save profile</button><span id="pmsg" class="muted" role="alert"></span></div>
      </form>

      <section class="paper plain">
        <span class="label">Appearance</span>
        <p style="margin:10px 0"><label for="theme">Theme</label><br>
          <select id="theme">
            <option value="auto" ${theme === 'auto' ? 'selected' : ''}>Follow my device</option>
            <option value="light" ${theme === 'light' ? 'selected' : ''}>Light desk</option>
            <option value="dark" ${theme === 'dark' ? 'selected' : ''}>Dark desk</option>
          </select></p>
      </section>

      <section class="paper plain">
        <span class="label">Your data</span>
        <p style="margin-top:10px">Your progress is saved to your account automatically. You can download a copy of everything at any time.</p>
        <div class="btn-row">
          <button class="btn ghost" id="dl">Download my data</button>
          ${readV1() && !S.priv.v1Imported ? '<button class="btn ghost" id="v1">Import Version 1 progress from this browser</button>' : ''}
          <label class="btn ghost" for="v1file" style="cursor:pointer">Import a Version 1 backup file</label>
          <input type="file" id="v1file" accept="application/json,.json" class="visually-hidden">
          ${S.isAdmin ? '<a class="btn ghost" href="#/admin">Admin: reports</a>' : ''}
          <button class="btn ghost" id="signout">Sign out</button>
        </div>
      </section>

      <section class="paper plain">
        <span class="label">Delete account</span>
        <p style="margin-top:10px">This permanently deletes your profile, progress, streaks, pages, comments, likes and friendships. Download your data first if you want to keep anything.</p>
        <button class="btn danger" id="delete">Delete my account</button>
        <p id="delmsg" class="muted" role="status"></p>
      </section>
    </div>
  </div>`;

  const picks = app.querySelectorAll('.av-opt');
  const mark = () => picks.forEach((b) => b.classList.toggle('on', b.dataset.av === avatar));
  picks.forEach((b) => b.addEventListener('click', () => { avatar = b.dataset.av; mark(); }));
  mark();

  document.getElementById('pform').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('pmsg');
    const nick = document.getElementById('nick').value.trim();
    const bio = document.getElementById('bio').value.trim().slice(0, 160);
    if (!NICK_RE.test(nick)) { msg.textContent = 'Use 3 to 20 letters, numbers or underscores.'; return; }
    msg.textContent = 'Saving...';
    try {
      if (nick !== p.nickname) await changeNickname(nick);
      await updateProfile({ bio, avatar });
      msg.textContent = 'Saved.';
      ctx.refreshNav();
    } catch (err) { msg.textContent = errText(err); }
  });

  document.getElementById('theme').addEventListener('change', (e) => { setTheme(e.target.value); toast('Theme updated.'); });
  document.getElementById('dl').addEventListener('click', async () => {
    try { await downloadMyData(); } catch (err) { toast(errText(err)); }
  });
  const v1 = document.getElementById('v1');
  if (v1) v1.addEventListener('click', async () => {
    if (!window.confirm('Add the Version 1 progress saved in this browser to your account?')) return;
    try { await importV1Progress(); ctx.rerender(); } catch (err) { toast(errText(err)); }
  });
  document.getElementById('v1file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      if (!obj || obj.version !== 1 || typeof obj.weeks !== 'object') throw new Error('This is not a Quiet Ink Version 1 backup file.');
      if (!window.confirm('Add the progress and reflections from this Version 1 backup to your account?')) return;
      await importV1Progress(obj);
      ctx.rerender();
    } catch (err) { toast(errText(err)); } finally { e.target.value = ''; }
  });
  document.getElementById('signout').addEventListener('click', async () => { await signOut(auth); ctx.go('#/'); });

  document.getElementById('delete').addEventListener('click', async () => {
    if (!window.confirm('Delete your Quiet Ink account and all of your data?')) return;
    const typed = window.prompt(`This cannot be undone. Type your nickname (${p.nickname}) to confirm.`);
    if (typed !== p.nickname) { toast('Nickname did not match. Nothing was deleted.'); return; }
    const msg = document.getElementById('delmsg');
    document.getElementById('delete').disabled = true;
    try {
      await deleteEverything((t) => { msg.textContent = t; });
      toast('Your account has been deleted.');
      location.hash = '#/';
    } catch (err) {
      msg.textContent = errText(err);
      document.getElementById('delete').disabled = false;
    }
  });
}
