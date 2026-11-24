/**
 * Session and data layer: the signed-in user, their profile, private progress and
 * this week's record. All Firestore paths are defined here.
 *
 * Database structure (see also SETUP.md):
 *   users/{uid}                    public profile: nickname, avatar, photo, points, streaks
 *   users/{uid}/private/state      private progress: correct questions, mistakes, topics, friends, blocks
 *   users/{uid}/weeks/{monday}     one record per week: fill sub-parts, flip quiz, phrases, speaking, page, points
 *   usernames/{nickname}           reserves a nickname: { uid }
 *   friendRequests/{from_to}       pending friend requests
 *   friendships/{uidA_uidB}        accepted friendships: { members: [a, b] } (a < b)
 */
import {
  doc, getDoc, setDoc, updateDoc, increment, runTransaction, serverTimestamp,
  collection, query, where, getDocs, writeBatch, arrayUnion, arrayRemove, deleteField
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { weekKey, dayKey } from './week.js';
import {
  emptyStreak, completeStreak, repairedStreak, emptyDayStreak, completeDayStreak, setWarmupHooks
} from './rules.js';

export const S = {
  user: null, // Firebase auth user
  profile: null, // users/{uid}
  priv: null, // users/{uid}/private/state
  data: null, // { questions, errorQuestions, builds, topics, prompts, phrases, speaking, rewrites }
  weekKey: null,
  week: null // users/{uid}/weeks/{weekKey}
};

export const userRef = (uid = S.user.uid) => doc(db, 'users', uid);
export const privRef = (uid = S.user.uid) => doc(db, 'users', uid, 'private', 'state');
export const weekRef = (wk, uid = S.user.uid) => doc(db, 'users', uid, 'weeks', wk);
export const pairId = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

export function defaultWeek() {
  return {
    fill: {
      classic: { sets: [], active: null },
      error: { sets: [], active: null },
      build: { sets: [], active: null }
    },
    flip: null,
    phrases: null,
    speak: null,
    page: null,
    warmups: [],
    points: { fill: 0, flip: 0, phrases: 0, speak: 0, page: 0, warmup: 0 }
  };
}

export function defaultStreaks() {
  return {
    fill: emptyStreak(), flip: emptyStreak(), phrases: emptyStreak(),
    speak: emptyStreak(), page: emptyStreak()
  };
}

export function defaultPriv() {
  return {
    grammarCorrect: [], mistakes: {}, flipCompleted: [],
    friendIds: [], blocked: [], v1Imported: false, firstWeek: weekKey(),
    daily: emptyDayStreak()
  };
}

/** Load profile and private state after sign-in. */
export async function loadAccount(user) {
  S.user = user;
  const [p, q] = await Promise.all([getDoc(userRef()), getDoc(privRef())]);
  S.profile = p.exists() ? { uid: user.uid, ...p.data() } : null;
  S.priv = q.exists() ? { ...defaultPriv(), ...q.data() } : null;
  S.week = null;
  S.weekKey = null;
  if (S.priv) setWarmupHooks({ mistakes: S.priv.mistakes, flipCompleted: S.priv.flipCompleted });
}

export function clearAccount() {
  Object.assign(S, { user: null, profile: null, priv: null, week: null, weekKey: null });
}

export const NICK_RE = /^[A-Za-z0-9_]{3,20}$/;

/** Create the account documents. The nickname is reserved in the same transaction. */
export async function createAccount({ nickname, bio, avatar, photoData }) {
  const uid = S.user.uid;
  const lower = nickname.toLowerCase();
  await runTransaction(db, async (tx) => {
    const nameRef = doc(db, 'usernames', lower);
    const snap = await tx.get(nameRef);
    if (snap.exists() && snap.data().uid !== uid) throw new Error('That nickname is already taken. Please try another one.');
    tx.set(nameRef, { uid });
    tx.set(userRef(uid), {
      nickname, nicknameLower: lower, bio, avatar,
      photoURL: S.user.photoURL || null,
      photoData: photoData || null,
      createdAt: serverTimestamp(),
      totalPoints: 0,
      weekPoints: { week: null, value: 0 },
      streaks: defaultStreaks(),
      repairUsed: false,
      repair: null
    });
    tx.set(privRef(uid), defaultPriv());
  });
  await loadAccount(S.user);
}

/** Change nickname: reserve the new one and release the old one. */
export async function changeNickname(nickname) {
  const uid = S.user.uid;
  const lower = nickname.toLowerCase();
  const oldLower = S.profile.nicknameLower;
  if (lower !== oldLower) {
    await runTransaction(db, async (tx) => {
      const newRef = doc(db, 'usernames', lower);
      const snap = await tx.get(newRef);
      if (snap.exists() && snap.data().uid !== uid) throw new Error('That nickname is already taken.');
      tx.set(newRef, { uid });
      tx.update(userRef(uid), { nickname, nicknameLower: lower });
      tx.delete(doc(db, 'usernames', oldLower));
    });
  } else {
    await updateDoc(userRef(uid), { nickname });
  }
  S.profile.nickname = nickname;
  S.profile.nicknameLower = lower;
}

export async function updateProfile(fields) {
  await updateDoc(userRef(), fields);
  Object.assign(S.profile, fields);
}

export async function updatePriv(fields) {
  await updateDoc(privRef(), fields);
}

/* ------------------------------------------------------------------ Weeks */
export async function ensureWeek() {
  const W = weekKey();
  if (S.week && S.weekKey === W) return S.week;
  const snap = await getDoc(weekRef(W));
  S.weekKey = W;
  const saved = snap.exists() ? snap.data() : {};
  S.week = deepMerge(defaultWeek(), saved);
  // Migrate a v2 fill shape (sets/active) into the v3 sub-part shape.
  if (saved.fill && saved.fill.sets && !saved.fill.classic) {
    S.week.fill = {
      classic: { sets: saved.fill.sets || [], active: saved.fill.active || null },
      error: { sets: [], active: null },
      build: { sets: [], active: null }
    };
  }
  return S.week;
}

/** Plain deep merge for plain objects (week docs are JSON-like). */
function deepMerge(base, saved) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!saved || typeof saved !== 'object') return out;
  for (const [k, v] of Object.entries(saved)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function saveWeek() {
  await setDoc(weekRef(S.weekKey), S.week);
}

const PART_KEYS = ['fill', 'flip', 'phrases', 'speak', 'page', 'warmup'];

/** Add points for a part and update the public totals. */
export async function addPoints(part, pts) {
  if (!pts) return;
  S.week.points[part] = (S.week.points[part] || 0) + pts;
  await saveWeek();
  const weekTotal = PART_KEYS.reduce((sum, k) => sum + (S.week.points[k] || 0), 0);
  S.profile.totalPoints = (S.profile.totalPoints || 0) + pts;
  S.profile.weekPoints = { week: S.weekKey, value: weekTotal };
  await updateDoc(userRef(), { totalPoints: increment(pts), weekPoints: { week: S.weekKey, value: weekTotal } });
}

/** Mark a part complete for this week and extend its streak. */
export async function completePart(part) {
  const next = completeStreak(S.profile.streaks[part], S.weekKey);
  S.profile.streaks[part] = next;
  await updateDoc(userRef(), { [`streaks.${part}`]: next });
}

/** Use the one-time streak repair on a part. */
export async function useRepair(part) {
  const next = repairedStreak(S.profile.streaks[part], S.weekKey);
  const repair = { part, week: S.weekKey };
  await updateDoc(userRef(), { [`streaks.${part}`]: next, repairUsed: true, repair });
  S.profile.streaks[part] = next;
  S.profile.repairUsed = true;
  S.profile.repair = repair;
}

/* ------------------------------------------------------------------ Daily streak */
/** Record today's warm-up: points + day streak, idempotent per day. */
export async function completeWarmup(pts) {
  const D = dayKey();
  if (S.week.warmups.includes(D)) return false;
  S.week.warmups.push(D);
  await saveWeek();
  await addPoints('warmup', pts);
  const next = completeDayStreak(S.priv.daily, D);
  S.priv.daily = next;
  await updatePriv({ daily: next });
  return true;
}

/* ------------------------------------------------------------------ Progress helpers */
export async function markCorrect(id) {
  if (!S.priv.grammarCorrect.includes(id)) S.priv.grammarCorrect.push(id);
  await updatePriv({ grammarCorrect: arrayUnion(id) });
}

export async function resetCorrect() {
  S.priv.grammarCorrect = [];
  await updatePriv({ grammarCorrect: [] });
}

export async function recordMistake(id, choice) {
  const m = S.priv.mistakes[id] || { count: 0 };
  const next = { count: (m.count || 0) + 1, last: Date.now(), choice: choice || null };
  S.priv.mistakes[id] = next;
  await updatePriv({ [`mistakes.${id}`]: next });
}

export async function clearMistake(id) {
  delete S.priv.mistakes[id];
  await updatePriv({ [`mistakes.${id}`]: deleteField() });
}

export async function addToList(field, value) {
  if (!S.priv[field].includes(value)) S.priv[field].push(value);
  await updatePriv({ [field]: arrayUnion(value) });
}

export async function removeFromList(field, value) {
  S.priv[field] = S.priv[field].filter((x) => x !== value);
  await updatePriv({ [field]: arrayRemove(value) });
}

/** Record flashcard review results for the warm-up mastery tracking. */
export async function recordCardResult(topicIndex, cardIndex, correct) {
  const key = `cardStats.${topicIndex}.${cardIndex}`;
  const cur = (S.priv.cardStats && S.priv.cardStats[topicIndex] && S.priv.cardStats[topicIndex][cardIndex]) || { right: 0, wrong: 0 };
  const next = correct ? { right: cur.right + 1, wrong: cur.wrong } : { right: cur.right, wrong: cur.wrong + 1 };
  if (!S.priv.cardStats) S.priv.cardStats = {};
  if (!S.priv.cardStats[topicIndex]) S.priv.cardStats[topicIndex] = {};
  S.priv.cardStats[topicIndex][cardIndex] = next;
  await updatePriv({ [key]: next });
}

/* ------------------------------------------------------------------ Friends sync
 * friendIds (private) lists your confirmed friends, used by the leaderboard.
 */
export async function setFriendIds(ids) {
  const clean = Array.from(new Set(ids)).filter((x) => !S.priv.blocked.includes(x)).sort();
  S.priv.friendIds = clean;
  await updatePriv({ friendIds: clean });
  return clean;
}

/** Rebuild friendIds from the friendships collection (picks up changes made by friends). */
export async function reconcileFriends() {
  const snap = await getDocs(query(collection(db, 'friendships'), where('members', 'array-contains', S.user.uid)));
  const ids = snap.docs.map((d) => d.data().members.find((m) => m !== S.user.uid)).filter(Boolean);
  return setFriendIds(ids);
}

/* ------------------------------------------------------------------ Past writings */
/** All past finished weekly pages, newest first, for "My Shelf". */
export async function pastPages() {
  const snap = await getDocs(collection(db, 'users', S.user.uid, 'weeks'));
  const pages = [];
  snap.docs.forEach((d) => {
    const w = d.data();
    if (w.page && w.page.published && w.page.draft) {
      pages.push({ weekKey: d.id, ...w.page });
    }
  });
  return pages.sort((a, b) => (a.weekKey < b.weekKey ? 1 : -1));
}
