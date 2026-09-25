import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase's web config is not a secret — it's meant to be shipped in client code. Access
// control is enforced by Firestore security rules (see firestore.rules), not by hiding this.
const firebaseConfig = {
  apiKey: 'AIzaSyAyxjdpl1mPcy8ZFct2gaPwY1vuZpnQ3Eg',
  authDomain: 'bt-double-elimination.firebaseapp.com',
  projectId: 'bt-double-elimination',
  storageBucket: 'bt-double-elimination.firebasestorage.app',
  messagingSenderId: '818742607551',
  appId: '1:818742607551:web:cc4788f337be505d7e100a',
};

export const firebaseApp = initializeApp(firebaseConfig);

// Local IndexedDB cache lets the app keep working offline / on a flaky connection, syncing
// automatically once back online. Single-tab manager keeps this simple — no cross-tab
// coordination needed for a small tournament-day tool.
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
});

export const storage = getStorage(firebaseApp);
