import { useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth } from '../firebase';
import { isAdminEmail } from './admins';

export interface AuthState {
  user: User | null;
  isAdmin: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

// Visitors never sign in — the app is fully readable without an account. Only admins use the
// Google sign-in, and whether they can edit is decided by their email (see admins.ts).
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(auth.currentUser);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  return {
    user,
    isAdmin: isAdminEmail(user?.email),
    signIn: async () => {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    signOut: () => signOut(auth),
  };
}
