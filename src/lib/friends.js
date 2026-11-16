/**
 * Friend requests, friendships and blocking.
 *   friendRequests/{from_to}   created by the sender; deleted by either person
 *   friendships/{a_b}          created by the receiver when accepting (a < b)
 */
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { S, pairId, setFriendIds, addToList, removeFromList } from './session.js';

const reqRef = (from, to) => doc(db, 'friendRequests', `${from}_${to}`);
const friendshipRef = (a, b) => doc(db, 'friendships', pairId(a, b));

/** 'self' | 'friends' | 'sent' | 'received' | 'blocked' | 'none' */
export async function statusWith(uid) {
  const me = S.user.uid;
  if (uid === me) return 'self';
  if (S.priv.blocked.includes(uid)) return 'blocked';
  const [f, sent, recv] = await Promise.all([
    getDoc(friendshipRef(me, uid)).catch(() => null),
    getDoc(reqRef(me, uid)).catch(() => null),
    getDoc(reqRef(uid, me)).catch(() => null)
  ]);
  if (f && f.exists()) return 'friends';
  if (recv && recv.exists()) return 'received';
  if (sent && sent.exists()) return 'sent';
  return 'none';
}

export async function sendRequest(target) {
  const me = S.user.uid;
  const incoming = await getDoc(reqRef(target.uid, me)).catch(() => null);
  if (incoming && incoming.exists()) return acceptRequest(target.uid);
  await setDoc(reqRef(me, target.uid), {
    from: me,
    to: target.uid,
    fromNick: S.profile.nickname,
    fromAvatar: S.profile.avatar || 'ink',
    fromPhoto: S.profile.photoURL || null,
    toNick: target.nickname,
    createdAt: serverTimestamp()
  });
  return 'sent';
}

export async function cancelRequest(to) {
  await deleteDoc(reqRef(S.user.uid, to));
}

export async function declineRequest(from) {
  await deleteDoc(reqRef(from, S.user.uid));
}

export async function acceptRequest(from) {
  const me = S.user.uid;
  const members = [me, from].sort();
  await setDoc(friendshipRef(me, from), { members, createdAt: serverTimestamp() });
  await deleteDoc(reqRef(from, me)).catch(() => {});
  await setFriendIds([...S.priv.friendIds, from]);
  return 'friends';
}

export async function removeFriend(uid) {
  await deleteDoc(friendshipRef(S.user.uid, uid)).catch(() => {});
  await setFriendIds(S.priv.friendIds.filter((x) => x !== uid));
}

export async function blockUser(uid) {
  const me = S.user.uid;
  await addToList('blocked', uid);
  await Promise.all([
    deleteDoc(friendshipRef(me, uid)).catch(() => {}),
    deleteDoc(reqRef(me, uid)).catch(() => {}),
    deleteDoc(reqRef(uid, me)).catch(() => {})
  ]);
  await setFriendIds(S.priv.friendIds.filter((x) => x !== uid));
}

export async function unblockUser(uid) {
  await removeFromList('blocked', uid);
}

export async function incomingRequests() {
  const snap = await getDocs(query(collection(db, 'friendRequests'), where('to', '==', S.user.uid)));
  return snap.docs.map((d) => d.data()).filter((r) => !S.priv.blocked.includes(r.from));
}

export async function outgoingRequests() {
  const snap = await getDocs(query(collection(db, 'friendRequests'), where('from', '==', S.user.uid)));
  return snap.docs.map((d) => d.data());
}

/** Public profiles for a list of uids. */
export async function profiles(uids) {
  const snaps = await Promise.all(uids.map((u) => getDoc(doc(db, 'users', u)).catch(() => null)));
  return snaps.filter((s) => s && s.exists()).map((s) => ({ uid: s.id, ...s.data() }));
}

export async function findUsers(text) {
  const q = text.trim().toLowerCase();
  if (q.length < 2) return [];
  const snap = await getDocs(query(collection(db, 'users'), where('nicknameLower', '>=', q), where('nicknameLower', '<', `${q}`)));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((u) => !S.priv.blocked.includes(u.uid)).slice(0, 12);
}
