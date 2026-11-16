/**
 * Server-corrected clock.
 * After sign-in we write a server timestamp and read it back, then keep the difference
 * between the server and this device. Timers, weekly deadlines and streaks all use now(),
 * so changing the device clock does not change results.
 */
import { doc, setDoc, getDocFromServer, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';

let offset = 0;

export function now() {
  return Date.now() + offset;
}

export async function syncClock(uid) {
  try {
    const ref = doc(db, 'users', uid, 'private', 'clock');
    const before = Date.now();
    await setDoc(ref, { t: serverTimestamp() });
    const snap = await getDocFromServer(ref);
    const after = Date.now();
    const t = snap.data() && snap.data().t;
    if (t && typeof t.toMillis === 'function') {
      offset = t.toMillis() - Math.round((before + after) / 2);
    }
  } catch (e) {
    offset = 0; // fall back to the device clock
  }
}
