/**
 * Settings: profile (with picture upload), theme, data download, sign out
 * and account deletion.
 */
import {
  collection, doc, getDoc, getDocs, deleteDoc, query, where
} from 'firebase/firestore';
import { deleteUser, reauthenticateWithPopup, signOut } from 'firebase/auth';
import { db, auth, googleProvider } from '../firebase.js';
import { esc, toast, errText, AVATARS, avatarSvg, avatarHtml, shrinkImage } from '../lib/ui.js';
import { S, NICK_RE, changeNickname, updateProfile, userRef, privRef } from '../lib/session.js';

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

/* ------------------------------------------------------------ data download */
async function downloadMyData() {
  const uid = S.user.uid;
  const [profile, priv, weeks] = await Promise.all([
    getDoc(userRef()), getDoc(privRef()),
    getDocs(collection(db, 'users', uid, 'weeks'))
  ]);
  const ts = (v) => JSON.parse(JSON.stringify(v, (k, x) => (x && typeof x.toMillis === 'function' ? new Date(x.toMillis()).toISOString() : x)));
  const out = {
    exportedAt: new Date().toISOString(),
    profile: ts(profile.data()),
    progress: ts(priv.data()),
    weeks: Object.fromEntries(weeks.docs.map((d) => [d.id, ts(d.data())]))
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
  let photoData = p.photoData || null;
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
        <fieldset class="field"><legend class="label">Profile picture</legend>
          <div class="avatar-picker">
            ${p.photoURL ? `<button type="button" class="av-opt" data-av="google" aria-label="My Google photo">${avatarHtml({ avatar: 'google', photoURL: p.photoURL }, 52)}</button>` : ''}
            ${AVATARS.map((a) => `<button type="button" class="av-opt" data-av="${a}" aria-label="${a} avatar">${avatarSvg(a, 52)}</button>`).join('')}
            <label class="av-opt upload ${photoData ? 'has-photo' : ''}" id="av-upload" title="Upload my own picture">
              <input type="file" accept="image/*" class="visually-hidden">
              ${photoData ? `<img id="av-upload-thumb" class="avatar" src="${photoData}" width="52" height="52" alt="My picture">` : `<span class="av-upload-ink">+<small>upload</small></span>`}
            </label>
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
          <button class="btn ghost" id="signout">Sign out</button>
        </div>
      </section>

      <section class="paper plain">
        <span class="label">Delete account</span>
        <p style="margin-top:10px">This permanently deletes your profile, progress, streaks and friendships. Download your data first if you want to keep anything.</p>
        <button class="btn danger" id="delete">Delete my account</button>
        <p id="delmsg" class="muted" role="status"></p>
      </section>
    </div>
  </div>`;

  const picks = app.querySelectorAll('.av-opt[data-av]');
  const mark = () => picks.forEach((b) => b.classList.toggle('on', b.dataset.av === avatar));
  picks.forEach((b) => b.addEventListener('click', () => {
    avatar = b.dataset.av;
    photoData = null;
    mark();
  }));

  document.getElementById('av-upload').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const msg = document.getElementById('pmsg');
    try {
      msg.textContent = 'Shrinking image...';
      photoData = await shrinkImage(file);
      avatar = 'photo';
      const up = document.getElementById('av-upload');
      const thumb = document.getElementById('av-upload-thumb');
      if (!thumb) up.insertAdjacentHTML('beforeend', `<img id="av-upload-thumb" class="avatar" src="${photoData}" width="52" height="52" alt="My picture">`);
      else thumb.src = photoData;
      up.classList.add('has-photo');
      mark();
      msg.textContent = 'Press "Save profile" to keep this picture.';
    } catch (err) {
      msg.textContent = errText(err);
      e.target.value = '';
    }
  });

  document.getElementById('pform').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('pmsg');
    const nick = document.getElementById('nick').value.trim();
    const bio = document.getElementById('bio').value.trim().slice(0, 160);
    if (!NICK_RE.test(nick)) { msg.textContent = 'Use 3 to 20 letters, numbers or underscores.'; return; }
    msg.textContent = 'Saving...';
    try {
      if (nick !== p.nickname) await changeNickname(nick);
      const fields = { bio, avatar };
      if (avatar === 'photo' && photoData) fields.photoData = photoData;
      if (avatar !== 'photo') fields.photoData = null;
      await updateProfile(fields);
      msg.textContent = 'Saved.';
      ctx.refreshNav();
    } catch (err) { msg.textContent = errText(err); }
  });

  document.getElementById('theme').addEventListener('change', (e) => { setTheme(e.target.value); toast('Theme updated.'); });
  document.getElementById('dl').addEventListener('click', async () => {
    try { await downloadMyData(); } catch (err) { toast(errText(err)); }
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
