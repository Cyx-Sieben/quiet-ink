/**
 * Game rules: points, timers, streaks and the weekly concept.
 * Change the numbers here to tune the game.
 */
import { prevWeek, addDays, weeksBetween } from './week.js';
import { shuffle } from './ui.js';

export const SETS_PER_WEEK = 5;
export const QUESTIONS_PER_SET = 5;
export const QUESTION_MS = 2 * 60 * 1000; // Fill the Gap: 2 minutes per question
export const FLIP_MS = 5 * 60 * 1000; // Word Flip: 5 minutes for the whole set of 10 cards

export const POINTS = {
  fillCorrect: 10,
  fillPerfectBonus: 10,
  flipCorrect: 10,
  flipPerfectBonus: 20,
  pagePublished: 50
};

export const PARTS = {
  fill: { name: 'Fill the Gap', short: 'Fill', route: '#/fill' },
  flip: { name: 'Word Flip', short: 'Flip', route: '#/flip' },
  page: { name: 'The Weekly Page', short: 'Page', route: '#/page' }
};

export function setPoints(score) {
  return score * POINTS.fillCorrect + (score === QUESTIONS_PER_SET ? POINTS.fillPerfectBonus : 0);
}

export function flipPoints(score, total) {
  return score * POINTS.flipCorrect + (score === total && total > 0 ? POINTS.flipPerfectBonus : 0);
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

/* ------------------------------------------------------- Weekly concept
 * Everyone gets the same concept each week. The order is a shuffle seeded by the
 * "cycle" number, so every concept appears once before the list repeats.
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

export function conceptOfWeek(prompts, W) {
  if (!prompts.length) return null;
  const n = prompts.length;
  const idx = weeksBetween(EPOCH, W);
  const cycle = Math.floor(idx / n);
  const pos = ((idx % n) + n) % n;
  const rand = mulberry32(1000 + cycle);
  const order = prompts.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return prompts[order[pos]];
}

/* ------------------------------------------------------- Question picking */
export function pickQuestions(questions, correctIds) {
  const correct = new Set(correctIds || []);
  let pool = questions.map((q) => q.id).filter((id) => !correct.has(id));
  let reset = false;
  if (pool.length < QUESTIONS_PER_SET) {
    pool = questions.map((q) => q.id);
    reset = true;
  }
  return { ids: shuffle(pool).slice(0, QUESTIONS_PER_SET), reset };
}

/** Three meaning options for a card: the right one plus two from other cards in the same topic. */
export function flipOptions(cards, i) {
  const others = shuffle(cards.map((c, j) => j).filter((j) => j !== i && cards[j].meaning !== cards[i].meaning)).slice(0, 2);
  return shuffle([i, ...others]);
}
