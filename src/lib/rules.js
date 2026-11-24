/**
 * Game rules: points, timers, streaks and the weekly pickers.
 * Change the numbers here to tune the game.
 */
import { prevWeek, addDays, weeksBetween } from './week.js';
import { shuffle } from './ui.js';

export const SETS_PER_WEEK = 1; // one "set" per sub-section per week
export const QUESTIONS_PER_SET = 5;
export const QUESTION_MS = 2 * 60 * 1000; // Fill the Gap: 2 minutes per question
export const FLIP_MS = 5 * 60 * 1000; // Word Flip: 5 minutes for the whole set of 10 cards

export const FILL_PARTS = {
  classic: { key: 'classic', name: 'Fill the Gap', short: 'Classic', desc: 'Pick the word that completes the sentence.' },
  error: { key: 'error', name: 'Spot & Fix', short: 'Fix', desc: 'Find the error and choose the corrected sentence.' },
  build: { key: 'build', name: 'Build the Sentence', short: 'Build', desc: 'Tap the words in order to build the sentence.' }
};

export const POINTS = {
  fillCorrect: 10,
  fillPerfectBonus: 10,
  flipCorrect: 10,
  flipPerfectBonus: 20,
  pageFinished: 50,
  phraseRead: 10,
  phraseCheck: 5,
  speakDraft: 25,
  speakReview: 10,
  warmup: 5
};

export const PARTS = {
  fill: { name: 'Fill the Gap', short: 'Fill', route: '#/fill' },
  flip: { name: 'Word Flip', short: 'Flip', route: '#/flip' },
  phrases: { name: 'Phrase Library', short: 'Phrases', route: '#/phrases' },
  speak: { name: 'Speaking Practice', short: 'Speak', route: '#/speaking' },
  page: { name: 'The Weekly Page', short: 'Page', route: '#/page' }
};

export function setPoints(score) {
  return score * POINTS.fillCorrect + (score === QUESTIONS_PER_SET ? POINTS.fillPerfectBonus : 0);
}

export function flipPoints(score, total) {
  return score * POINTS.flipCorrect + (score === total && total > 0 ? POINTS.flipPerfectBonus : 0);
}

export function phrasePoints(checked) {
  return POINTS.phraseRead + (checked ? POINTS.phraseCheck : 0);
}

export function speakPoints(reviewed) {
  return POINTS.speakDraft + (reviewed ? POINTS.speakReview : 0);
}

/* ------------------------------------------------------------------ Streaks
 * A streak is { current, best, lastWeek }, where lastWeek is the Monday key of the
 * most recent completed week. It is "alive" if lastWeek is this week or last week.
 */
export const emptyStreak = () => ({ current: 0, best: 0, lastWeek: null });

export function liveStreak(st, W) {
  if (!st || !st.lastWeek) return 0;
  return st.lastWeek === W || st.lastWeek === prevWeek(W) ? st.current : 0;
}

/** Streak after completing the part in week W. */
export function completeStreak(st, W) {
  const s = st || emptyStreak();
  if (s.lastWeek === W) return s;
  const current = s.lastWeek === prevWeek(W) ? s.current + 1 : 1;
  return { current, best: Math.max(s.best || 0, current), lastWeek: W };
}

/**
 * A broken streak can be repaired during the week right after the missed week:
 * the last completed week was two weeks ago, so only last week was missed.
 */
export function canRepair(profile, part, W) {
  if (!profile || profile.repairUsed) return false;
  const st = profile.streaks && profile.streaks[part];
  return Boolean(st && st.current > 0 && st.lastWeek === addDays(W, -14));
}

/** Streak after using the repair: last week counts as kept (it earns no points). */
export function repairedStreak(st, W) {
  return { ...st, lastWeek: prevWeek(W) };
}

/* ------------------------------------------------------- Daily streak (warm-up)
 * A day streak is { current, best, lastDay }, where lastDay is a YYYY-MM-DD key
 * (Malaysian calendar day). Alive if lastDay is today or yesterday.
 */
export const emptyDayStreak = () => ({ current: 0, best: 0, lastDay: null });

export function liveDayStreak(st, D) {
  if (!st || !st.lastDay) return 0;
  const yesterday = addDays(D, -1);
  return st.lastDay === D || st.lastDay === yesterday ? st.current : 0;
}

export function completeDayStreak(st, D) {
  const s = st || emptyDayStreak();
  if (s.lastDay === D) return s;
  const current = s.lastDay === addDays(D, -1) ? s.current + 1 : 1;
  return { current, best: Math.max(s.best || 0, current), lastDay: D };
}

/* ------------------------------------------------------- Weekly pickers
 * Everyone gets the same item each week (concept, phrase, speaking prompt).
 * The order is a shuffle seeded by the "cycle" number, so every item appears
 * once before the list repeats.
 */
const EPOCH = '2026-01-05'; // a Monday

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function itemOfWeek(items, W, seedOffset = 0) {
  if (!items || !items.length) return null;
  const n = items.length;
  const idx = weeksBetween(EPOCH, W);
  const cycle = Math.floor(idx / n);
  const pos = ((idx % n) + n) % n;
  const rand = mulberry32(1000 + cycle + seedOffset);
  const order = items.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return items[order[pos]];
}

/** Kept for compatibility: the weekly writing concept. */
export function conceptOfWeek(prompts, W) {
  return itemOfWeek(prompts, W, 0);
}

export function phraseOfWeek(phrases, W) {
  return itemOfWeek(phrases, W, 700);
}

export function promptOfWeek(prompts, W) {
  return itemOfWeek(prompts, W, 1400);
}

/* ------------------------------------------------------- Question picking */
export function pickQuestions(questions, correctIds, count = QUESTIONS_PER_SET) {
  const correct = new Set(correctIds || []);
  let pool = questions.map((q) => q.id).filter((id) => !correct.has(id));
  let reset = false;
  if (pool.length < count) {
    pool = questions.map((q) => q.id);
    reset = true;
  }
  return { ids: shuffle(pool).slice(0, count), reset };
}

/** Three meaning options for a card: the right one plus two from other cards in the same topic. */
export function flipOptions(cards, i) {
  const others = shuffle(cards.map((c, j) => j).filter((j) => j !== i && cards[j].meaning !== cards[i].meaning)).slice(0, 2);
  return shuffle([i, ...others]);
}

/* ------------------------------------------------------- Warm-up picking
 * Deterministic per day: the same three items if you re-open the warm-up that day.
 */
export function warmupOfDay(dayKey, data) {
  const idx = Math.abs(Date.parse(dayKey) / 86400000) | 0;
  const rand = mulberry32(idx);
  const pick1 = (arr) => arr[Math.floor(rand() * arr.length)];

  // One gap question, preferring past mistakes when there are any.
  const mistakes = Object.keys(S_MISTAKES || {});
  let gap = null;
  const mistakePool = (data.questions || []).filter((q) => mistakes.includes(q.id));
  if (mistakePool.length) gap = pick1(mistakePool);
  else if ((data.questions || []).length) gap = pick1(data.questions);

  // One flashcard review: a card from the most recently completed topic.
  let card = null;
  const doneTopics = (S_FLIP_COMPLETED || []).slice(-1);
  if (doneTopics.length) {
    const topic = data.topics[doneTopics[0]];
    if (topic && topic.cards && topic.cards.length) card = pick1(topic.cards);
  }

  // One rewrite drill.
  const rewrite = pick1(data.rewrites);

  return { gap, card, rewrite };
}

// Mutable hooks set by session.js so rules.js stays import-clean.
let S_MISTAKES = null;
let S_FLIP_COMPLETED = null;
export function setWarmupHooks({ mistakes, flipCompleted }) {
  S_MISTAKES = mistakes;
  S_FLIP_COMPLETED = flipCompleted;
}
