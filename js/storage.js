/**
 * Progress storage (browser localStorage).
 *
 * State shape:
 * {
 *   version: 1,
 *   firstWeek: "2026-11-02",           // Monday of the first week the app was opened
 *   weeks: {
 *     "2026-11-02": {
 *       sets: [{ finishedAt, score, ids, answers }],   // finished puzzle sets (max 5)
 *       active: { ids, index, answers } | null,         // puzzle set in progress
 *       flash: { topic, learned: [], done, doneAt } | null,
 *       reflection: { id, draft, text, submitted, submittedAt, words } | null
 *     }
 *   },
 *   grammar: { correct: [ids], mistakes: { id: { count, last } } },
 *   flash: { completed: [topicIndex, ...] },
 *   reflect: { order: [ids], cursor: 0 }
 * }
 */

const KEY = 'quietink.v1';
const THEME_KEY = 'quietink.theme';

let state = null;
let storageOk = true;

export function defaultState() {
  return {
    version: 1,
    firstWeek: null,
    weeks: {},
    grammar: { correct: [], mistakes: {} },
    flash: { completed: [] },
    reflect: { order: [], cursor: 0 }
  };
}

/** Merge saved data over defaults so older saves gain any new fields. */
function normalise(obj) {
  const base = defaultState();
  const s = Object.assign(base, obj || {});
  s.weeks = s.weeks || {};
  s.grammar = Object.assign({ correct: [], mistakes: {} }, s.grammar || {});
  s.flash = Object.assign({ completed: [] }, s.flash || {});
  s.reflect = Object.assign({ order: [], cursor: 0 }, s.reflect || {});
  return s;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    state = normalise(raw ? JSON.parse(raw) : null);
  } catch (e) {
    storageOk = false;
    state = defaultState();
  }
  return state;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageOk = true;
  } catch (e) {
    storageOk = false;
  }
}

export function getState() { return state; }
export function isStorageOk() { return storageOk; }

/** Get (and create if needed) the record for one week. */
export function weekRecord(key) {
  if (!state.weeks[key]) {
    state.weeks[key] = { sets: [], active: null, flash: null, reflection: null };
  }
  return state.weeks[key];
}

/** Download all progress as a JSON file. */
export function exportProgress() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `quiet-ink-progress-${today}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Replace progress with an imported JSON string. Throws if the file is not valid. */
export function importProgress(text) {
  const obj = JSON.parse(text);
  if (!obj || typeof obj !== 'object' || obj.version !== 1 || typeof obj.weeks !== 'object') {
    throw new Error('This file does not look like a Quiet Ink progress file.');
  }
  state = normalise(obj);
  save();
}

export function resetProgress() {
  state = defaultState();
  save();
}

export function getTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { return 'auto'; }
}

export function setTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
  try {
    if (theme === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch (e) { /* ignore */ }
}
