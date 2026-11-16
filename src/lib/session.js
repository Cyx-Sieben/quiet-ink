/**
 * Session and data layer: the signed-in user, their profile, private progress and
 * this week's record. All Firestore paths are defined here.
 *
 * Database structure (see also SETUP.md):
 *   users/{uid}                    public profile: nickname, avatar, points, streaks
 *   users/{uid}/private/state      private progress: correct questions, mistakes, topics, friends, blocks
 *   users/{uid}/weeks/{monday}     one record per week: sets, flip quiz, writing draft, points
 *   usernames/{nickname}           reserves a nickname: { uid }
 *   pieces/{uid_monday}            published weekly pieces (likes and comments are sub-collections)
 *   friendRequests/{from_to}       pending friend requests
 *   friendships/{uidA_uidB}        accepted friendships: { members: [a, b] } (a < b)
 *   reports/{id}                   reported pieces and comments (admins only)
 *   admins/{uid}                   create by hand in the console to make someone an admin
 */
import {
  doc, getDoc, setDoc, updateDoc, increment, runTransaction, serverTimestamp,
  collection, query, where, getDocs, writeBatch, arrayUnion, arrayRemove, deleteField
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { weekKey } from './week.js';
import { emptyStreak, completeStreak, repairedStreak } from './rules.js';

export const S = {
  user: null, // Firebase auth user
  profile: null, // users/{uid}
  priv: null, // users/{uid}/private/state
  isAdmin: false,
  data: null, // { questions, topics, prompts }
  weekKey: null,
  week: null // users/{uid}/weeks/{weekKey}
};

export const userRef = (uid = S.user.uid) => doc(db, 'users', uid);
export const privRef = (uid = S.user.uid) => doc(db, 'users', uid, 'private', 'state');
export const weekRef = (wk, uid = S.user.uid) => doc(db, 'users', uid, 'weeks', wk);
export const pieceId = (uid, wk) => `${uid}_${wk}`;
export const pairId = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

export function defaultWeek() {
  return {
    fill: { sets: [], active: null },
    flip: null,
    page: null,
    points: { fill: 0, flip: 0, page: 0 }
  };
}

export function defaultStreaks() {
  return { fill: emptyStreak(), flip: emptyStreak(), page: emptyStreak() };
}

export function defaultPriv() {
  return {
    grammarCorrect: [], mistakes: {}, flipCompleted: [],
    friendIds: [], blocked: [], hidden: [], hiddenComments: [],
    v1Imported: false, firstWeek: weekKey()
  };
}

/** Load profile, private state and admin flag after sign-in. */
export async function loadAccount(user) {
  S.user = user;
  const [p, q] = await Promise.all([getDoc(userRef()), getDoc(privRef())]);
  S.profile = p.exists() ? { uid: user.uid, ...p.data() } : null;
  S.priv = q.exists() ? { ...defaultPriv(), ...q.data() } : null;
  S.isAdmin = false;
  if (S.profile) {
    try { S.isAdmin = (await getDoc(doc(db, 'admins', user.uid))).exists(); } catch (e) { S.isAdmin = false; }
  }
  S.week = null;
  S.weekKey = null;
}

export function clearAccount() {
  Object.assign(S, { user: null, profile: null, priv: null, isAdmin: false, week: null, weekKey: null });
}

export const NICK_RE = /^[A-Za-z0-9_]{3,20}$/;

/** Create the account documents. The nickname is reserved in the same transaction. */
export async function createAccount({ nickname, bio, avatar }) {
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

/** Change nickname: reserve the new one, release the old one, update own pieces. */
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
  await updateOwnPieces({ authorNick: nickname });
}

export async function updateProfile(fields) {
  await updateDoc(userRef(), fields);
  Object.assign(S.profile, fields);
  if ('avatar' in fields || 'photoURL' in fields) {
    await updateOwnPieces({ authorAvatar: S.profile.avatar, authorPhoto: S.profile.photoURL || null });
  }
}

export async function updatePriv(fields) {
  await updateDoc(privRef(), fields);
}

/** Apply a change to every piece this user has published. */
export async function updateOwnPieces(fieldsOrFn) {
  const snap = await getDocs(query(collection(db, 'pieces'), where('uid', '==', S.user.uid)));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    const fields = typeof fieldsOrFn === 'function' ? fieldsOrFn(d.data()) : fieldsOrFn;
    if (fields) batch.update(d.ref, fields);
  });
  await batch.commit();
}

/* ------------------------------------------------------------------ Weeks */
export async function ensureWeek() {
  const W = weekKey();
  if (S.week && S.weekKey === W) return S.week;
  const snap = await getDoc(weekRef(W));
  S.weekKey = W;
  S.week = snap.exists() ? { ...defaultWeek(), ...snap.data() } : defaultWeek();
  if (!S.week.points) S.week.points = { fill: 0, flip: 0, page: 0 };
  return S.week;
}

export async function saveWeek() {
  await setDoc(weekRef(S.weekKey), S.week);
}

/** Add points for a part and update the public totals. */
export async function addPoints(part, pts) {
  if (!pts) return;
  S.week.points[part] = (S.week.points[part] || 0) + pts;
  await saveWeek();
  const weekTotal = S.week.points.fill + S.week.points.flip + S.week.points.page;
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

/* ------------------------------------------------------------------ Friends sync
 * friendIds (private) lists who may read this user's friends-only pieces. It is
 * copied onto each piece so the security rules can check it.
 */
export async function setFriendIds(ids) {
  const clean = Array.from(new Set(ids)).filter((x) => !S.priv.blocked.includes(x)).sort();
  const same = clean.length === S.priv.friendIds.length && clean.every((x, i) => x === S.priv.friendIds.slice().sort()[i]);
  S.priv.friendIds = clean;
  if (same) return;
  await updatePriv({ friendIds: clean });
  await updateOwnPieces((p) => ({ friendIds: p.visibility === 'private' ? [] : clean }));
}

/** Rebuild friendIds from the friendships collection (picks up changes made by friends). */
export async function reconcileFriends() {
  const snap = await getDocs(query(collection(db, 'friendships'), where('members', 'array-contains', S.user.uid)));
  const ids = snap.docs.map((d) => d.data().members.find((m) => m !== S.user.uid)).filter(Boolean);
  await setFriendIds(ids);
  return ids;
}
