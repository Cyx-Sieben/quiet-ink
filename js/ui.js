/**
 * Shared helpers: HTML escaping, shuffling, and reusable SVG decorations.
 */

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Fisher-Yates shuffle (returns a new array). */
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

/** Four corner handles for the red "selection box" effect. */
export const HANDLES = '<span class="hd tl"></span><span class="hd tr"></span><span class="hd bl"></span><span class="hd br"></span>';

/** Short-lived message at the bottom of the screen. */
export function toast(message) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/** Metal binder clip (original SVG). */
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

/** Small hand-drawn arrow. */
export function arrowDoodle(cls = 'arrow-doodle') {
  return `
<svg class="${cls}" viewBox="0 0 70 50" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M6 8 C 22 2, 40 6, 46 20 S 50 40, 62 42"/>
  <path d="M52 44 L63 42 L58 32"/>
</svg>`;
}

/** Hand-drawn underline. */
export function squiggle(color = 'var(--blue)') {
  return `
<svg viewBox="0 0 220 16" width="220" height="16" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" aria-hidden="true" style="display:block;max-width:100%">
  <path d="M4 10 C 30 2, 50 14, 78 8 S 128 4, 150 10 S 196 12, 216 6"/>
</svg>`;
}

/** Original retro typewriter illustration with a halftone dot fill. */
export function typewriter(cls = 'typewriter-art') {
  return `
<svg class="${cls}" viewBox="0 0 200 170" aria-hidden="true">
  <defs>
    <pattern id="halftone" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="#d8d6cf"/>
      <circle cx="3" cy="3" r="1.6" fill="#141414"/>
    </pattern>
    <pattern id="halftoneFine" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="4" fill="#ecebe6"/>
      <circle cx="2" cy="2" r="0.9" fill="#141414"/>
    </pattern>
  </defs>
  <!-- paper sheet -->
  <rect x="62" y="6" width="76" height="62" fill="#ffffff" stroke="#141414" stroke-width="2"/>
  <path d="M72 22 H128 M72 32 H122 M72 42 H116" stroke="#2F5BEA" stroke-width="2"/>
  <!-- platen -->
  <rect x="34" y="56" width="132" height="18" rx="9" fill="url(#halftoneFine)" stroke="#141414" stroke-width="2.5"/>
  <circle cx="30" cy="65" r="8" fill="#141414"/>
  <circle cx="170" cy="65" r="8" fill="#141414"/>
  <!-- body -->
  <path d="M22 78 H178 L192 148 Q194 160 182 160 H18 Q6 160 8 148 Z" fill="url(#halftone)" stroke="#141414" stroke-width="2.5"/>
  <rect x="66" y="86" width="68" height="12" rx="3" fill="#141414"/>
  <!-- keys -->
  <g fill="#ffffff" stroke="#141414" stroke-width="1.8">
    <circle cx="38" cy="114" r="6"/><circle cx="56" cy="114" r="6"/><circle cx="74" cy="114" r="6"/><circle cx="92" cy="114" r="6"/><circle cx="110" cy="114" r="6"/><circle cx="128" cy="114" r="6"/><circle cx="146" cy="114" r="6"/><circle cx="164" cy="114" r="6"/>
    <circle cx="46" cy="132" r="6"/><circle cx="64" cy="132" r="6"/><circle cx="82" cy="132" r="6"/><circle cx="100" cy="132" r="6"/><circle cx="118" cy="132" r="6"/><circle cx="136" cy="132" r="6"/><circle cx="154" cy="132" r="6"/>
  </g>
  <rect x="66" y="144" width="70" height="9" rx="4" fill="#ffffff" stroke="#141414" stroke-width="1.8"/>
  <!-- red accent key -->
  <circle cx="164" cy="114" r="6" fill="#E8322A" stroke="#141414" stroke-width="1.8"/>
</svg>`;
}

/** Ornament trio used across the app. */
export const ORN = '<span class="ornaments" aria-hidden="true">✸ ✦ ♣</span>';
