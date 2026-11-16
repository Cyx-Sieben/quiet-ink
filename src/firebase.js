/**
 * Firebase initialisation. Every other file imports `auth` and `db` from here.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config.js';

export const MOCK = import.meta.env.VITE_MOCK === 'true';

/** False until real settings are pasted into firebase-config.js (mock mode always counts as configured). */
export const configured = MOCK || !String(firebaseConfig.apiKey || '').startsWith('PASTE');

export const app = configured ? initializeApp(firebaseConfig) : null;
export const auth = configured ? getAuth(app) : null;
export const db = configured ? getFirestore(app) : null;
export const googleProvider = configured ? new GoogleAuthProvider() : null;
if (googleProvider && googleProvider.setCustomParameters) {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}
