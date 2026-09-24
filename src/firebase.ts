import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';

// Firebase's web config is not a secret — it's meant to be shipped in client code. Access
// control is enforced by Firestore security rules (see firestore.rules), not by hiding this.
const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.firebasestorage.app',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

export const firebaseApp = initializeApp(firebaseConfig);

// Local IndexedDB cache lets the app keep working offline / on a flaky connection, syncing
// automatically once back online. Single-tab manager keeps this simple — no cross-tab
// coordination needed for a small tournament-day tool.
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
});
