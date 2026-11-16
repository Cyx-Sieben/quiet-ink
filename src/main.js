/**
 * Quiet Ink v2: entry point, authentication and router.
 * Routes use the URL hash (#/fill, #/read ...) so every page works on any static host.
 */
import './styles.css';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, configured, MOCK } from './firebase.js';
import { S, loadAccount, clearAccount, ensureWeek, reconcileFriends } from './lib/session.js';
import { syncClock } from './lib/clock.js';
import { esc, toast, errText, avatarHtml } from './lib/ui.js';

import { renderLanding, renderDashboard } from './views/home.js';
import { renderOnboarding } from './views/onboarding.js';
import { renderFill, renderFillPlay } from './views/fill.js';
import { renderFlip, renderFlipPlay } from './views/flip.js';
import { renderWrite } from './views/page.js';
import { renderReadingRoom, renderPiece, renderTopic } from './views/read.js';
import { renderProfile } from './views/profile.js';
import { renderFriends } from './views/friends.js';
import { renderNewsstand } from './views/newsstand.js';
import { renderMistakes, renderPastTopics, renderTopicReview } from './views/archive.js';
import { renderSettings } from './views/settings.js';
import { renderAdmin } from './views/admin.js';
import { renderPrivacy, renderGuidelines, renderSetupNeeded } from './views/static.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');
let cleanup = null;
let authReady = false;

/* ---------------------------------------------------------------- data */
async function loadData() {
  const names = ['grammar_questions', 'flashcard_topics', 'writing_prompts'];
  const [questions, topics, prompts] = await Promise.all(
    names.map(async (n) => {
      const res = await fetch(`/data/${n}.json`);
      if (!res.ok) throw new Error(`Could not load /data/${n}.json (${res.status})`);
      return res.json();
    })
  );
  return { questions, topics, prompts };
}

/* ---------------------------------------------------------------- auth actions */
export async function signIn() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    if (!String(err.code || '').includes('popup-closed')) toast(errText(err));
  }
}

export async function doSignOut() {
  await signOut(auth);
  location.hash = '#/';
}

/* ---------------------------------------------------------------- navigation bar */
function renderNav() {
  if (!S.profile) {
    nav.innerHTML = `
      <a href="#/read" data-nav="read">Reading Room</a>
      <a href="#/newsstand" data-nav="newsstand">Newsstand</a>
      ${S.user ? '' : '<button class="btn small" id="nav-signin">Sign in with Google</button>'}`;
    const b = document.getElementById('nav-signin');
    if (b) b.addEventListener('click', signIn);
    return;
  }
  nav.innerHTML = `
    <a href="#/" data-nav="home">Desk</a>
    <a href="#/fill" data-nav="fill">Fill the Gap</a>
    <a href="#/flip" data-nav="flip">Word Flip</a>
    <a href="#/page" data-nav="page">Write</a>
    <a href="#/read" data-nav="read">Read</a>
    <a href="#/newsstand" data-nav="newsstand">News</a>
    <a href="#/friends" data-nav="friends">Friends</a>
    <a href="#/@${esc(S.profile.nickname)}" data-nav="me" class="nav-me" aria-label="My profile">${avatarHtml(S.profile, 26)}<span>${esc(S.profile.nickname)}</span></a>
    <a href="#/settings" data-nav="settings" aria-label="Settings">⚙</a>`;
}

function setActiveNav(name) {
  nav.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

/* ---------------------------------------------------------------- router */
// [pattern, nav name, needs account?, view]
const routes = [
  [/^\/?$/, 'home', false, (ctx) => (S.profile ? renderDashboard(app, ctx) : renderLanding(app, ctx))],
  [/^\/welcome\/?$/, '', 'user', (ctx) => renderOnboarding(app, ctx)],
  [/^\/fill\/?$/, 'fill', true, (ctx) => renderFill(app, ctx)],
  [/^\/fill\/play\/?$/, 'fill', true, (ctx) => renderFillPlay(app, ctx)],
  [/^\/flip\/?$/, 'flip', true, (ctx) => renderFlip(app, ctx)],
  [/^\/flip\/play\/?$/, 'flip', true, (ctx) => renderFlipPlay(app, ctx)],
  [/^\/page\/?$/, 'page', true, (ctx) => renderWrite(app, ctx)],
  [/^\/read\/?$/, 'read', false, (ctx) => renderReadingRoom(app, ctx, 'week')],
  [/^\/read\/(week|latest|friends|topics|search)\/?$/, 'read', false, (ctx, m) => renderReadingRoom(app, ctx, m[1])],
  [/^\/read\/topic\/([\w-]+)\/?$/, 'read', false, (ctx, m) => renderTopic(app, ctx, m[1])],
  [/^\/p\/([\w-]+)\/?$/, 'read', false, (ctx, m) => renderPiece(app, ctx, m[1])],
  [/^\/@([A-Za-z0-9_]+)\/?$/, 'me', false, (ctx, m) => renderProfile(app, ctx, m[1])],
  [/^\/friends\/?$/, 'friends', true, (ctx) => renderFriends(app, ctx)],
  [/^\/newsstand\/?$/, 'newsstand', false, (ctx) => renderNewsstand(app, ctx)],
  [/^\/mistakes\/?$/, 'fill', true, (ctx) => renderMistakes(app, ctx)],
  [/^\/topics\/?$/, 'flip', true, (ctx) => renderPastTopics(app, ctx)],
  [/^\/topics\/(\d+)\/?$/, 'flip', true, (ctx, m) => renderTopicReview(app, ctx, Number(m[1]))],
  [/^\/settings\/?$/, 'settings', true, (ctx) => renderSettings(app, ctx)],
  [/^\/admin\/?$/, '', true, (ctx) => renderAdmin(app, ctx)],
  [/^\/privacy\/?$/, '', false, (ctx) => renderPrivacy(app, ctx)],
  [/^\/guidelines\/?$/, '', false, (ctx) => renderGuidelines(app, ctx)]
];

function ctx() {
  return {
    S,
    data: S.data,
    go: (hash) => { location.hash = hash; },
    rerender: route,
    signIn,
    refreshNav: renderNav
  };
}

async function route() {
  if (!authReady) return;
  if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { /* ignore */ } }
  cleanup = null;
  const path = decodeURIComponent((location.hash || '#/').slice(1)) || '/';

  // Signed in but no profile yet: finish setting up the account first.
  if (S.user && !S.profile && !/^\/(welcome|privacy|guidelines)\/?$/.test(path)) {
    location.hash = '#/welcome';
    return;
  }

  for (const [re, navName, needs, view] of routes) {
    const m = path.match(re);
    if (!m) continue;
    const own = navName === 'me' && S.profile && m[1] && m[1].toLowerCase() === S.profile.nicknameLower;
    setActiveNav(navName === 'me' && !own ? '' : navName);
    if (needs === true && !S.profile) {
      renderSignInWall();
      return;
    }
    if (needs === 'user' && !S.user) {
      location.hash = '#/';
      return;
    }
    try {
      if (S.profile) await ensureWeek();
      cleanup = (await view(ctx(), m)) || null;
    } catch (err) {
      console.error(err);
      app.innerHTML = `<div class="paper notice"><p class="pixel-title">Something went wrong</p><p>${esc(errText(err))}</p><p><a href="#/">Back to your desk</a></p></div>`;
    }
    window.scrollTo({ top: 0 });
    return;
  }
  setActiveNav('');
  app.innerHTML = '<div class="paper notice"><p class="pixel-title">Page not found</p><p><a href="#/">Back to your desk</a></p></div>';
}

function renderSignInWall() {
  app.innerHTML = `
  <div class="paper spiral notice enter" style="text-align:center">
    <span class="hand">members only</span>
    <p class="pixel-title" style="margin:10px 0">Sign in to continue</p>
    <p class="lead">Your weekly tasks, points and streaks are saved to your account.</p>
    <button class="btn" id="wall-signin">Sign in with Google</button>
  </div>`;
  document.getElementById('wall-signin').addEventListener('click', signIn);
}

/* ---------------------------------------------------------------- start */
async function init() {
  if (!configured) {
    renderSetupNeeded(app);
    return;
  }
  try {
    S.data = await loadData();
  } catch (err) {
    app.innerHTML = `<div class="paper notice"><p class="pixel-title">The desk could not open</p><p>${esc(err.message)}</p></div>`;
    return;
  }

  if (MOCK) {
    document.body.insertAdjacentHTML('afterbegin', '<div class="mock-banner">Mock mode: data is fake and stays in this browser only.</div>');
  }

  window.addEventListener('hashchange', route);

  onAuthStateChanged(auth, async (user) => {
    authReady = false;
    app.innerHTML = '<div class="loading"><p class="pixel-title">Opening your desk</p></div>';
    try {
      if (user) {
        await syncClock(user.uid);
        await loadAccount(user);
        if (S.profile) reconcileFriends().catch(() => {});
      } else {
        clearAccount();
      }
    } catch (err) {
      console.error(err);
      toast(errText(err));
    }
    renderNav();
    authReady = true;
    route();
  });

  // Offline support and "Add to home screen" (production builds only).
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

init();
