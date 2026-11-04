/**
 * Quiet Ink: entry point and router.
 * Uses hash routes (#/puzzles etc.) so it works on GitHub Pages without a server.
 */

import * as store from './storage.js';
import { weekKey, weekNumber } from './week.js';
import { esc } from './ui.js';
import { renderDashboard } from './views/dashboard.js';
import { renderPuzzles, renderPuzzlePlay } from './views/puzzles.js';
import { renderFlashcards } from './views/flashcards.js';
import { renderReflection } from './views/reflection.js';
import { renderMistakes, renderArchive, renderTopicReview, renderWritingEntry, renderSettings } from './views/archive.js';

const app = document.getElementById('app');
let data = null;
let cleanup = null; // function returned by a view to clear timers or listeners

async function loadData() {
  const names = ['grammar_questions', 'flashcard_topics', 'writing_prompts'];
  const [questions, topics, prompts] = await Promise.all(
    names.map(async (n) => {
      const res = await fetch(`data/${n}.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Could not load data/${n}.json (${res.status})`);
      return res.json();
    })
  );
  return { questions, topics, prompts };
}

/** Build the context object handed to every view. Recomputed on each route so a new week is picked up. */
function context() {
  const state = store.getState();
  const key = weekKey();
  if (!state.firstWeek || state.firstWeek > key) {
    state.firstWeek = key;
  }
  const rec = store.weekRecord(key);
  store.save();
  return {
    data,
    state,
    key,
    rec,
    weekNo: weekNumber(state.firstWeek, key),
    save: store.save,
    go: (hash) => { location.hash = hash; },
    rerender: route
  };
}

const routes = [
  [/^\/?$/, 'home', (ctx) => renderDashboard(app, ctx)],
  [/^\/puzzles\/?$/, 'puzzles', (ctx) => renderPuzzles(app, ctx)],
  [/^\/puzzles\/play\/?$/, 'puzzles', (ctx) => renderPuzzlePlay(app, ctx)],
  [/^\/flashcards\/?$/, 'flashcards', (ctx) => renderFlashcards(app, ctx)],
  [/^\/reflection\/?$/, 'reflection', (ctx) => renderReflection(app, ctx)],
  [/^\/mistakes\/?$/, 'mistakes', (ctx) => renderMistakes(app, ctx)],
  [/^\/archive\/?$/, 'archive', (ctx) => renderArchive(app, ctx)],
  [/^\/archive\/topic\/(\d+)\/?$/, 'archive', (ctx, m) => renderTopicReview(app, ctx, Number(m[1]))],
  [/^\/archive\/writing\/([\d-]+)\/?$/, 'archive', (ctx, m) => renderWritingEntry(app, ctx, m[1])],
  [/^\/settings\/?$/, 'settings', (ctx) => renderSettings(app, ctx)]
];

function route() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  const path = (location.hash || '#/').slice(1) || '/';
  const ctx = context();

  let matched = false;
  for (const [re, nav, view] of routes) {
    const m = path.match(re);
    if (m) {
      setActiveNav(nav);
      cleanup = view(ctx, m) || null;
      matched = true;
      break;
    }
  }
  if (!matched) {
    setActiveNav('');
    app.innerHTML = `<div class="paper notice"><p class="pixel-title">Page not found</p><p><a href="#/">Back to your desk</a></p></div>`;
  }
  window.scrollTo({ top: 0 });
}

function setActiveNav(name) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

async function init() {
  store.load();
  try {
    data = await loadData();
  } catch (err) {
    const fileProtocol = location.protocol === 'file:';
    app.innerHTML = `
      <div class="paper notice">
        <p class="pixel-title">The desk could not open</p>
        <p>${esc(err.message)}</p>
        ${fileProtocol ? '<p>Browsers block loading data files when a page is opened straight from your folder. Run a small local server instead (see the README), or open the GitHub Pages link.</p>' : ''}
      </div>`;
    return;
  }
  window.addEventListener('hashchange', route);
  route();
}

init();
