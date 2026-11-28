/*
 * Offline mock of firebase/auth, used only by `npm run dev:mock`.
 * "Sign in with Google" asks for a name and signs you in as a test user with that name,
 * so you can try friends and the leaderboard by signing in as two different people.
 */
const USER_KEY = 'quietink.mock.user';
const listeners = new Set();

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '') || 'writer';
}

function makeUser(name) {
  const s = slug(name);
  return { uid: `mock_${s}`, displayName: name, email: `${s}@example.com`, photoURL: null };
}

const authSingleton = { currentUser: null };
try {
  const saved = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  if (saved) authSingleton.currentUser = makeUser(saved.displayName);
} catch (e) { /* ignore */ }

function notify() {
  listeners.forEach((cb) => cb(authSingleton.currentUser));
}

export function getAuth() {
  return authSingleton;
}

export class GoogleAuthProvider {
  setCustomParameters() {}
}

export function onAuthStateChanged(auth, cb) {
  listeners.add(cb);
  setTimeout(() => cb(authSingleton.currentUser), 0);
  return () => listeners.delete(cb);
}

export async function signInWithPopup() {
  let name = null;
  try {
    name = window.prompt('Mock sign-in (no real Google account is used).\nType any name to sign in as that test user:', 'Aisha');
  } catch (e) { /* prompt unavailable (some embedded browsers) */ }
  if (!name) {
    // Prompt blocked or cancelled: fall back to the default test user so the
    // mock stays usable in embedded/automated browsers.
    name = 'Aisha';
  }
  authSingleton.currentUser = makeUser(name.trim());
  try { localStorage.setItem(USER_KEY, JSON.stringify({ displayName: name.trim() })); } catch (e) { /* ignore */ }
  notify();
  return { user: authSingleton.currentUser };
}

export async function signOut() {
  authSingleton.currentUser = null;
  try { localStorage.removeItem(USER_KEY); } catch (e) { /* ignore */ }
  notify();
}

export async function reauthenticateWithPopup() {
  return { user: authSingleton.currentUser };
}

export async function deleteUser() {
  return signOut();
}
