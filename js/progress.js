/**
 * Progress rules shared by several views.
 */

import { addDays } from './week.js';
import { shuffle } from './ui.js';

export const SETS_PER_WEEK = 5;
export const QUESTIONS_PER_SET = 5;
export const MIN_WORDS = 150;

/** Is every part finished for this week record? */
export function weekComplete(rec) {
  return Boolean(
    rec &&
    rec.sets && rec.sets.length >= SETS_PER_WEEK &&
    rec.flash && rec.flash.done &&
    rec.reflection && rec.reflection.submitted
  );
}

/** Consecutive complete weeks, counting back from this week (or last week if this one is unfinished). */
export function streak(state, key) {
  let k = key;
  if (!weekComplete(state.weeks[k])) k = addDays(k, -7);
  let count = 0;
  while (state.firstWeek && k >= state.firstWeek && weekComplete(state.weeks[k])) {
    count++;
    k = addDays(k, -7);
  }
  return count;
}

/**
 * Which flashcard topic belongs to this week.
 * Topics advance by completion, not by calendar, so a missed week never skips a topic.
 */
export function flashTopicIndex(ctx) {
  const { rec, state } = ctx;
  if (rec.flash) return rec.flash.topic;
  return state.flash.completed.length;
}

/** Make sure this week has a writing concept assigned, and return it. */
export function ensureReflection(ctx) {
  const { rec, state, data } = ctx;
  if (rec.reflection) {
    return data.prompts.find((p) => p.id === rec.reflection.id) || null;
  }
  if (!data.prompts.length) return null;
  const ids = data.prompts.map((p) => p.id);
  const r = state.reflect;
  // Rebuild the order when it is empty, used up, or out of date with the data file.
  const valid = r.order.length === ids.length && r.order.every((id) => ids.includes(id));
  if (!valid || r.cursor >= r.order.length) {
    r.order = shuffle(ids);
    r.cursor = 0;
  }
  const id = r.order[r.cursor];
  r.cursor += 1;
  rec.reflection = { id, draft: '', text: '', submitted: false, submittedAt: null, words: 0 };
  ctx.save();
  return data.prompts.find((p) => p.id === id) || null;
}

/** Pick question ids for a new set, avoiding questions already answered correctly in this cycle. */
export function pickQuestions(ctx) {
  const { state, data } = ctx;
  const allIds = data.questions.map((q) => q.id);
  const correct = new Set(state.grammar.correct);
  let pool = allIds.filter((id) => !correct.has(id));
  if (pool.length < QUESTIONS_PER_SET) {
    // The whole bank has been mastered: start a new cycle.
    state.grammar.correct = [];
    pool = allIds;
  }
  return shuffle(pool).slice(0, QUESTIONS_PER_SET);
}
