/**
 * Shared helpers: escaping, shuffling, toast messages and original SVG decorations.
 */

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function countWords(text) {
  const m = String(text || '').trim().match(/\S+/g);
  return m ? m.length : 0;
}

export function readingTime(words) {
  return `${Math.max(1, Math.round(words / 220))} min read`;
}

export const HANDLES = '<span class="hd tl"></span><span class="hd tr"></span><span class="hd bl"></span><span class="hd br"></span>';
export const ORN = '<span class="ornaments" aria-hidden="true">✸ ✦ ♣</span>';

export function toast(message) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/** Friendly text for Firebase errors. */
export function errText(err) {
  const code = (err && err.code) || '';
  if (code.includes('permission-denied')) return 'You do not have permission to do that.';
  if (code.includes('unavailable') || code.includes('network')) return 'You seem to be offline. Please try again.';
  if (code.includes('popup-closed')) return 'Sign-in was cancelled.';
  if (code.includes('failed-precondition')) return 'The database needs an index. Run "npm run deploy:rules" (see SETUP.md).';
  return (err && err.message) || 'Something went wrong. Please try again.';
}

export function binderClip(cls = 'clip') {
  return `
<svg class="${cls}" viewBox="0 0 150 70" aria-hidden="true">
  <defs>
    <linearGradient id="clipMetal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e4e4e1"/>
      <stop offset="0.55" stop-color="#a9a9a5"/>
      <stop offset="1" stop-color="#7b7b77"/>
    </linearGradient>
  </defs>
  <path d="M48 30 Q46 6 75 6 Q104 6 102 30" fill="none" stroke="#8a8a86" stroke-width="5" stroke-linecap="round"/>
  <path d="M56 30 Q55 14 75 14 Q95 14 94 30" fill="none" stroke="#b9b9b5" stroke-width="3" stroke-linecap="round"/>
  <path d="M18 34 H132 L120 66 H30 Z" fill="url(#clipMetal)" stroke="#6d6d69" stroke-width="1.5"/>
  <path d="M26 40 H124" stroke="#f4f4f2" stroke-width="2" opacity=".7"/>
</svg>`;
}

export function arrowDoodle(cls = 'arrow-doodle') {
  return `
<svg class="${cls}" viewBox="0 0 70 50" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M6 8 C 22 2, 40 6, 46 20 S 50 40, 62 42"/>
  <path d="M52 44 L63 42 L58 32"/>
</svg>`;
}

export function squiggle(color = 'var(--blue)') {
  return `
<svg viewBox="0 0 220 16" width="220" height="16" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" aria-hidden="true" style="display:block;max-width:100%">
  <path d="M4 10 C 30 2, 50 14, 78 8 S 128 4, 150 10 S 196 12, 216 6"/>
</svg>`;
}

export function typewriter(cls = 'typewriter-art') {
  return `
<svg class="${cls}" viewBox="0 0 200 170" aria-hidden="true">
  <defs>
    <pattern id="halftone" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="#d8d6cf"/><circle cx="3" cy="3" r="1.6" fill="#141414"/>
    </pattern>
    <pattern id="halftoneFine" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="4" fill="#ecebe6"/><circle cx="2" cy="2" r="0.9" fill="#141414"/>
    </pattern>
  </defs>
  <rect x="62" y="6" width="76" height="62" fill="#ffffff" stroke="#141414" stroke-width="2"/>
  <path d="M72 22 H128 M72 32 H122 M72 42 H116" stroke="#2F5BEA" stroke-width="2"/>
  <rect x="34" y="56" width="132" height="18" rx="9" fill="url(#halftoneFine)" stroke="#141414" stroke-width="2.5"/>
  <circle cx="30" cy="65" r="8" fill="#141414"/><circle cx="170" cy="65" r="8" fill="#141414"/>
  <path d="M22 78 H178 L192 148 Q194 160 182 160 H18 Q6 160 8 148 Z" fill="url(#halftone)" stroke="#141414" stroke-width="2.5"/>
  <rect x="66" y="86" width="68" height="12" rx="3" fill="#141414"/>
  <g fill="#ffffff" stroke="#141414" stroke-width="1.8">
    <circle cx="38" cy="114" r="6"/><circle cx="56" cy="114" r="6"/><circle cx="74" cy="114" r="6"/><circle cx="92" cy="114" r="6"/><circle cx="110" cy="114" r="6"/><circle cx="128" cy="114" r="6"/><circle cx="146" cy="114" r="6"/>
    <circle cx="46" cy="132" r="6"/><circle cx="64" cy="132" r="6"/><circle cx="82" cy="132" r="6"/><circle cx="100" cy="132" r="6"/><circle cx="118" cy="132" r="6"/><circle cx="136" cy="132" r="6"/><circle cx="154" cy="132" r="6"/>
  </g>
  <rect x="66" y="144" width="70" height="9" rx="4" fill="#ffffff" stroke="#141414" stroke-width="1.8"/>
  <circle cx="164" cy="114" r="6" fill="#E8322A" stroke="#141414" stroke-width="1.8"/>
</svg>`;
}

/* ------------------------------------------------------------ Streak flame */
const FLAME_PATH = 'M12 2c1 3.5-1.5 5-1.5 7.5 0 1.4 1 2.5 2.3 2.5 1.6 0 2.4-1.3 2.2-3 2.3 1.7 3.5 4.2 3.5 6.5A6.5 6.5 0 0 1 12 22a6.5 6.5 0 0 1-6.5-6.5C5.5 10.5 12 7.5 12 2z';

export function flameBadge(count, { label = '', lit = count > 0, rot = '-2deg' } = {}) {
  return `<span class="sticker flame ${lit ? 'lit' : 'cold'}" style="--rot:${rot}" title="${esc(label)} weekly streak">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${FLAME_PATH}"/></svg>
    <b>${count}</b><span>${label ? esc(label) + ' · ' : ''}${count === 1 ? 'week' : 'weeks'}</span>
  </span>`;
}

/* ------------------------------------------------------------ Timer (pencil) */
export function timerHtml(id = 'timer') {
  return `<div class="timer" id="${id}" role="timer" aria-live="off">
    <div class="pencil-track"><div class="pencil"><span class="tip"></span></div></div>
    <span class="time">--:--</span>
  </div>`;
}

export function setTimer(el, msLeft, total) {
  if (!el) return;
  const pct = Math.max(0, Math.min(100, (msLeft / total) * 100));
  el.querySelector('.pencil').style.width = `${pct}%`;
  const t = Math.max(0, Math.ceil(msLeft / 1000));
  el.querySelector('.time').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  el.classList.toggle('low', msLeft <= Math.min(20000, total * 0.2));
}

/* ------------------------------------------------------------ Avatars */
export const AVATARS = ['ink', 'star', 'clover', 'moon', 'diamond', 'flower', 'drop', 'leaf'];
const AV_COLORS = {
  ink: ['#141414', '#F2F0EB'], star: ['#2F5BEA', '#ffffff'], clover: ['#CDEFD9', '#141414'], moon: ['#E3D9F7', '#141414'],
  diamond: ['#E8322A', '#ffffff'], flower: ['#FBDCC8', '#141414'], drop: ['#2F5BEA', '#F2F0EB'], leaf: ['#141414', '#CDEFD9']
};

function starPoints(cx, cy, outer, inner, n) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI / n) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function avatarShape(id, fg) {
  switch (id) {
    case 'star': return `<polygon points="${starPoints(32, 33, 20, 8, 5)}" fill="${fg}"/>`;
    case 'clover': return `<g fill="${fg}"><circle cx="32" cy="22" r="9"/><circle cx="22" cy="36" r="9"/><circle cx="42" cy="36" r="9"/><rect x="30" y="38" width="4" height="14" rx="2"/></g>`;
    case 'moon': return `<path d="M40 14a19 19 0 1 0 0 36a15 15 0 1 1 0-36z" fill="${fg}"/>`;
    case 'diamond': return `<polygon points="32,12 50,32 32,52 14,32" fill="${fg}"/>`;
    case 'flower': return `<g fill="${fg}">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="32" cy="20" rx="7" ry="11" transform="rotate(${a} 32 32)"/>`).join('')}<circle cx="32" cy="32" r="6" fill="#E8322A"/></g>`;
    case 'drop': return `<path d="M32 12c8 12 15 19 15 27a15 15 0 0 1-30 0c0-8 7-15 15-27z" fill="${fg}"/>`;
    case 'leaf': return `<path d="M16 48C16 26 30 14 50 14c0 22-12 34-34 34z" fill="${fg}"/><path d="M18 46L44 20" stroke="#141414" stroke-width="2.5"/>`;
    default: return `<polygon points="${starPoints(32, 32, 20, 6, 4)}" fill="${fg}"/>`; // ink sparkle
  }
}

export function avatarSvg(id, size = 44) {
  const [bg, fg] = AV_COLORS[id] || AV_COLORS.ink;
  return `<svg class="avatar" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="${bg}"/>${avatarShape(id, fg)}</svg>`;
}

/** Avatar for any profile-like object { avatar, photoURL, photoData }. */
export function avatarHtml(p, size = 44) {
  if (p && p.photoData) {
    return `<img class="avatar" src="${esc(p.photoData)}" width="${size}" height="${size}" alt="" loading="lazy">`;
  }
  if (p && p.avatar === 'google' && p.photoURL) {
    return `<img class="avatar" src="${esc(p.photoURL)}" width="${size}" height="${size}" alt="" referrerpolicy="no-referrer" loading="lazy">`;
  }
  return avatarSvg((p && p.avatar) || 'ink', size);
}

/** Downscale an uploaded image file to a small base64 JPEG (for the profile doc). */
export async function shrinkImage(file, max = 256, quality = 0.75) {
  if (!/^image\//.test(file.type)) throw new Error('Please choose an image file.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  if (dataUrl.length > 200 * 1024) throw new Error('That image is still too large after resizing. Try a simpler picture.');
  return dataUrl;
}
