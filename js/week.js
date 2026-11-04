/**
 * Week logic.
 * A "week" runs Monday 00:00 to Sunday 23:59 in Asia/Kuala_Lumpur (UTC+8).
 * Malaysia does not use daylight saving time, so a fixed offset is safe.
 * Every week is identified by the date of its Monday, e.g. "2026-11-02".
 */

const OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A Date shifted to Malaysian wall-clock time. Read it with getUTC* methods only. */
export function localNow() {
  return new Date(Date.now() + OFFSET_MS);
}

/** Key (YYYY-MM-DD) of the Monday that starts the week containing `d`. */
export function weekKey(d = localNow()) {
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceMonday));
  return monday.toISOString().slice(0, 10);
}

/** Add whole days to a week key and return a new key. */
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Week number counted from the first week the app was opened (week 1). */
export function weekNumber(firstKey, key) {
  return Math.round((Date.parse(key) - Date.parse(firstKey)) / (7 * DAY_MS)) + 1;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2 Nov" style date from a key. */
export function shortDate(key) {
  const d = new Date(Date.parse(key));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Mon 9 Nov" style date from a key. */
export function dayDate(key) {
  const d = new Date(Date.parse(key));
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "2 Nov to 8 Nov 2026" */
export function weekRange(key) {
  const end = addDays(key, 6);
  return `${shortDate(key)} to ${shortDate(end)} ${end.slice(0, 4)}`;
}

/** Milliseconds until next Monday 00:00 Malaysian time. */
export function msUntilReset() {
  const now = localNow();
  const next = Date.parse(addDays(weekKey(now), 7));
  return Math.max(0, next - now.getTime());
}

/** "4d 6h 12m" */
export function formatCountdown(ms) {
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  return `${d}d ${h}h ${m}m`;
}

/** Readable timestamp for saved writing, in Malaysian time. */
export function stamp(iso) {
  const d = new Date(Date.parse(iso) + OFFSET_MS);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm}`;
}
