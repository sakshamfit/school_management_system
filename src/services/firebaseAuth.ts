/**
 * Firebase Authentication integration for the school portal.
 *
 * Security model (post hardening):
 *   - Principal signs in with Firebase Auth email/password (real account;
 *     password NEVER stored in the app source, Firestore, or local files).
 *   - Teachers use their 6-digit teacher code; the app establishes an
 *     anonymous Firebase Auth session so that Firestore security rules can
 *     require authentication (the rules now deny unauthenticated access).
 *
 * The control-plane licensing layer (Electron desktop) is separate and
 * unrelated to school operational authentication.
 */

import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export function watchFirebaseAuth(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function signInPrincipal(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
}

/** Teacher code sign-in UX stays identical; the session is anonymous. */
export async function signInTeacherSession() {
  return signInAnonymously(auth);
}

export async function signOutFirebase() {
  try {
    await signOut(auth);
  } catch {
    /* best effort */
  }
}

export function mapAuthError(code?: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection.';
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'This sign-in method is not enabled yet. The administrator must enable it in the Firebase console (see DEPLOYMENT.md).';
    default:
      return 'Sign-in failed. Please try again.';
  }
}
