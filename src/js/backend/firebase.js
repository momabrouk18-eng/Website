// Talks to Firebase: Authentication (accounts and login) and Firestore (the database).
// Every other file goes through these functions instead of calling Firebase directly.
import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail, sendEmailVerification, updateProfile, signOut as fbSignOut
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc as fbGetDoc, writeBatch
} from 'firebase/firestore';
import { firebaseConfig } from '../../firebase-config.js';

let auth;
let db;

export const kind = 'firebase';

export async function init() {
  let cfg = firebaseConfig;
  if (!cfg || !cfg.apiKey) {
    try {
      const r = await fetch('/__/firebase/init.json');
      cfg = r.ok ? await r.json() : null;
    } catch {
      cfg = null;
    }
  }
  if (!cfg || !cfg.apiKey) throw new Error('NO_CONFIG');
  const app = initializeApp(cfg);
  auth = getAuth(app);
  // The local cache keeps the app fast and lets it work briefly offline.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true
  });
}

const toUser = u => (u ? { uid: u.uid, email: u.email || '', displayName: u.displayName || '', emailVerified: !!u.emailVerified } : null);

// ---------- accounts ----------
export const onUser = cb => onAuthStateChanged(auth, u => cb(toUser(u)));
export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export async function signUp(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  sendEmailVerification(cred.user).catch(() => {});
  return toUser(cred.user);
}
export const google = () => signInWithPopup(auth, new GoogleAuthProvider());
export const resetPassword = email => sendPasswordResetEmail(auth, email);
export const signOut = () => fbSignOut(auth);

// ---------- database ----------
// Paths look like "suppliers/abc123" (a document) or "suppliers" (a collection).
const ref = path => doc(db, ...path.split('/'));

export async function getDoc(path) {
  const s = await fbGetDoc(ref(path));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}
export function watchDoc(path, cb, onError) {
  return onSnapshot(ref(path), s => cb(s.exists() ? { id: s.id, ...s.data() } : null), onError);
}
export function watchCol(name, cb, onError) {
  return onSnapshot(collection(db, name), snap => cb(snap.docs.map(d => ({ ...d.data(), id: d.id }))), onError);
}
export const newId = name => doc(collection(db, name)).id;
export const set = (path, data, merge = false) => setDoc(ref(path), data, { merge });
export const update = (path, patch) => updateDoc(ref(path), patch);
export const remove = path => deleteDoc(ref(path));

// ops: [{ type: 'set' | 'update' | 'delete', path, data }]. Firestore allows 500 writes per batch.
export async function batch(ops) {
  for (let i = 0; i < ops.length; i += 450) {
    const b = writeBatch(db);
    ops.slice(i, i + 450).forEach(op => {
      if (op.type === 'delete') b.delete(ref(op.path));
      else if (op.type === 'update') b.update(ref(op.path), op.data);
      else b.set(ref(op.path), op.data, { merge: !!op.merge });
    });
    await b.commit();
  }
}

// Turns Firebase error codes into sentences people understand.
export function explain(err) {
  const code = err?.code || err?.message || '';
  const map = {
    'auth/invalid-email': 'That email address doesn’t look right.',
    'auth/missing-password': 'Enter your password.',
    'auth/invalid-credential': 'Email or password is wrong.',
    'auth/wrong-password': 'Email or password is wrong.',
    'auth/user-not-found': 'No account uses this email. Create one instead.',
    'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
    'auth/weak-password': 'Use at least 6 characters for the password.',
    'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
    'auth/popup-closed-by-user': 'The Google window was closed before signing in.',
    'auth/cancelled-popup-request': 'The Google window was closed before signing in.',
    'auth/popup-blocked': 'The browser blocked the Google window. Allow pop-ups for this site and try again.',
    'auth/unauthorized-domain': 'Google sign-in isn’t allowed on this address yet. Add it in Firebase → Authentication → Settings → Authorized domains, or use email and password.',
    'auth/operation-not-allowed': 'This sign-in method is switched off in Firebase → Authentication → Sign-in method.',
    'auth/network-request-failed': 'No connection. Check the internet and try again.',
    'permission-denied': 'You don’t have permission to do that.',
    'unavailable': 'The database can’t be reached right now. Changes will sync when you’re back online.'
  };
  return map[code] || 'Something went wrong. Try again.';
}
