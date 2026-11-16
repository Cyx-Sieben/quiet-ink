/**
 * Week logic.
 * A week runs Monday 00:00 to Sunday 23:59 in Asia/Kuala_Lumpur (UTC+8, no daylight saving).
 * Every week is identified by the date of its Monday, for example "2026-11-02".
 */
import { now } from './clock.js';

const OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A Date shifted to Malaysian wall-clock time. Read it with getUTC* methods only. */
export function localNow(ms = now()) {
  return new Date(ms + OFFSET_MS);
}

/** Monday key (YYYY-MM-DD) of the week containing the given moment. */
export function weekKey(ms = now()) {
  const d = localNow(ms);
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceMonday));
  return monday.toISOString().slice(0, 10);
}

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export const prevWeek = (key) => addDays(key, -7);
export const nextWeek = (key) => addDays(key, 7);

/** Whole weeks between two Monday keys. */
export function weeksBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / (7 * DAY_MS));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function shortDate(key) {
  const d = new Date(Date.parse(key));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function dayDate(key) {
  const d = new Date(Date.parse(key));
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function weekRange(key) {
  const end = addDays(key, 6);
  return `${shortDate(key)} to ${shortDate(end)} ${end.slice(0, 4)}`;
}

/** Milliseconds until next Monday 00:00 Malaysian time. */
export function msUntilReset() {
  const next = Date.parse(nextWeek(weekKey())) - OFFSET_MS;
  return Math.max(0, next - now());
}

export function formatCountdown(ms) {
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  return `${d}d ${h}h ${m}m`;
}

/** "02:00" style timer text. */
export function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Readable date for a Firestore timestamp or milliseconds, in Malaysian time. */
export function stamp(value) {
  const ms = value && typeof value.toMillis === 'function' ? value.toMillis() : Number(value);
  if (!ms) return '';
  const d = new Date(ms + OFFSET_MS);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
