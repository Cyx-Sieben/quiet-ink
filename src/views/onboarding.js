/**
 * First sign-in: choose a nickname, bio and avatar (built-in, Google photo,
 * or your own uploaded picture).
 */
import { esc, toast, errText, AVATARS, avatarSvg, avatarHtml, shrinkImage } from '../lib/ui.js';
import { createAccount, NICK_RE, S, ensureWeek } from '../lib/session.js';

export function renderOnboarding(app, ctx) {
  if (S.profile) { ctx.go('#/'); return; }
  const suggested = (S.user.displayName || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 20);
  let avatar = S.user.photoURL ? 'google' : 'ink';
  let photoData = null;
  let previewEl = null;

  app.innerHTML = `
  <div class="enter" style="max-width:720px;margin:0 auto">
    <header class="page-head">
      <span class="label">Welcome</span>
      <h1 class="pixel-title">Make your writer's badge</h1>
      <span class="hand">this is how friends will find you</span>
    </header>
    <form class="paper spiral stack" id="ob-form" novalidate>
      <label class="field">
        <span class="label">Nickname</span>
        <input id="ob-nick" maxlength="20" autocomplete="nickname" value="${esc(suggested)}" required>
        <small class="muted">3 to 20 characters: letters, numbers and underscores. People search for you by this name.</small>
      </label>
      <label class="field">
        <span class="label">Short bio (optional)</span>
        <textarea id="ob-bio" maxlength="160" rows="2" placeholder="Student, reader, collector of good sentences."></textarea>
      </label>
      <fieldset class="field">
        <legend class="label">Profile picture</legend>
        <div class="avatar-picker" id="ob-avatars">
          ${S.user.photoURL ? `<button type="button" class="av-opt" data-av="google" aria-label="My Google photo">${avatarHtml({ avatar: 'google', photoURL: S.user.photoURL }, 56)}</button>` : ''}
          ${AVATARS.map((a) => `<button type="button" class="av-opt" data-av="${a}" aria-label="${a} avatar">${avatarSvg(a, 56)}</button>`).join('')}
          <label class="av-opt upload" id="ob-upload" title="Upload my own picture">
            <input type="file" accept="image/*" class="visually-hidden">
            <span class="av-upload-ink">+<small>upload</small></span>
          </label>
        </div>
        <small class="muted">Pick a sticker avatar, use your Google photo, or upload your own — it is shrunk to a small thumbnail.</small>
      </fieldset>
      <p class="muted" style="font-size:.85rem;margin:0">Your email address is never shown to other people. By continuing you agree to the <a href="#/guidelines">community guidelines</a> and <a href="#/privacy">privacy note</a>.</p>
      <div class="btn-row">
        <button class="btn" type="submit" id="ob-go">Create my account</button>
        <span id="ob-msg" class="muted" role="alert"></span>
      </div>
    </form>
  </div>`;

  const picks = app.querySelectorAll('.av-opt[data-av]');
  const mark = () => {
    picks.forEach((b) => b.classList.toggle('on', b.dataset.av === avatar));
    const up = document.getElementById('ob-upload');
    if (up) up.classList.toggle('on', Boolean(photoData));
  };
  picks.forEach((b) => b.addEventListener('click', () => {
    avatar = b.dataset.av;
    photoData = null;
    mark();
  }));

  document.getElementById('ob-upload').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const msg = document.getElementById('ob-msg');
    try {
      msg.textContent = 'Shrinking image...';
      photoData = await shrinkImage(file);
      avatar = 'photo';
      // Swap the plus sign for the real thumbnail (the input itself stays in place).
      const thumb = document.getElementById('ob-upload-thumb');
      const up = document.getElementById('ob-upload');
      if (!thumb) up.insertAdjacentHTML('beforeend', `<img id="ob-upload-thumb" class="avatar" src="${photoData}" width="56" height="56" alt="My picture">`);
      else thumb.src = photoData;
      up.classList.add('has-photo');
      mark();
      msg.textContent = '';
    } catch (err) {
      msg.textContent = errText(err);
      e.target.value = '';
    }
  });

  mark();

  document.getElementById('ob-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = document.getElementById('ob-nick').value.trim();
    const bio = document.getElementById('ob-bio').value.trim().slice(0, 160);
    const msg = document.getElementById('ob-msg');
    if (!NICK_RE.test(nickname)) {
      msg.textContent = 'Please use 3 to 20 letters, numbers or underscores.';
      return;
    }
    const btn = document.getElementById('ob-go');
    btn.disabled = true;
    msg.textContent = 'Saving...';
    try {
      await createAccount({
        nickname, bio,
        avatar: avatar === 'photo' ? 'photo' : avatar,
        photoData: avatar === 'photo' ? photoData : null
      });
      ctx.refreshNav();
      toast(`Welcome, ${nickname}.`);
      ctx.go('#/');
    } catch (err) {
      msg.textContent = errText(err);
      btn.disabled = false;
    }
  });
}
