import { initializeApp, getApps } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.apiKey.length > 5);
let auth = null;
let provider = null;

try {
  if (isFirebaseConfigured) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
  }
} catch (error) {
  console.warn('Firebase initialization failed:', error.message);
}

function formatUser(user) {
  return {
    id: user.uid,
    email: user.email,
    displayName: user.displayName || user.email?.split('@')[0] || 'Community Guardian',
    photoURL: user.photoURL
  };
}

export async function signInWithGoogle() {
  if (auth && provider) {
    try {
      return formatUser((await signInWithPopup(auth, provider)).user);
    } catch (error) {
      throw new Error(`Google sign-in failed: ${error.message}`);
    }
  }
  if (import.meta.env.DEV) return { id: `dev_user_${crypto.randomUUID()}`, email: 'dev@nirbhay.local', displayName: 'Development User', isDevelopmentUser: true };
  throw new Error('Google sign-in is not configured. Add the Firebase settings in Render and redeploy.');
}

export async function signInWithEmail(email, password, createAccount = false) {
  if (!auth) throw new Error('Email sign-in is not configured. Add the Firebase settings in Render and redeploy.');
  try {
    const result = createAccount
      ? await createUserWithEmailAndPassword(auth, email, password)
      : await signInWithEmailAndPassword(auth, email, password);
    return formatUser(result.user);
  } catch (error) {
    const messages = {
      'auth/email-already-in-use': 'An account already exists for this email. Sign in instead.',
      'auth/invalid-credential': 'Incorrect email or password.',
      'auth/weak-password': 'Use a password with at least 6 characters.',
      'auth/invalid-email': 'Enter a valid email address.',
      'auth/operation-not-allowed': 'Email sign-in is not enabled in Firebase yet.'
    };
    throw new Error(messages[error.code] || 'Email sign-in failed. Please try again.');
  }
}

// One-step email-only sign-in: tries to create an account, falls back to sign-in if it exists.
// Uses a deterministic password derived from the email so the user never has to set one.
export async function signInWithEmailOnly(email) {
  if (!auth) {
    // Dev fallback
    if (import.meta.env.DEV) {
      return { id: `dev_${btoa(email).slice(0, 8)}`, email, displayName: email.split('@')[0], isDevelopmentUser: true };
    }
    throw new Error('Sign-in is not configured. Add the Firebase settings in Render and redeploy.');
  }
  // Derive a stable password from the email — never shown to the user
  const derivedPassword = `Nirbhay_${btoa(email)}_2024!`;
  try {
    const result = await createUserWithEmailAndPassword(auth, email, derivedPassword);
    return formatUser(result.user);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      try {
        const result = await signInWithEmailAndPassword(auth, email, derivedPassword);
        return formatUser(result.user);
      } catch (signInError) {
        const messages = {
          'auth/invalid-credential': 'Could not sign in. This email may have been registered with a different method (e.g. Google).',
          'auth/invalid-email': 'Enter a valid email address.',
        };
        throw new Error(messages[signInError.code] || 'Sign-in failed. Please try again.');
      }
    }
    const messages = {
      'auth/invalid-email': 'Enter a valid email address.',
      'auth/operation-not-allowed': 'Email sign-in is not enabled in Firebase yet.',
    };
    throw new Error(messages[error.code] || 'Sign-in failed. Please try again.');
  }
}

export async function getAuthHeaders() {
  if (auth?.currentUser) return { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` };
  try {
    const savedUser = JSON.parse(localStorage.getItem('nirbhay_user') || '{}');
    if (import.meta.env.DEV && savedUser.isDevelopmentUser) return { 'X-Development-User': savedUser.id };
  } catch (_) {}
  return {};
}

export async function signOutUser() {
  if (auth) await firebaseSignOut(auth).catch(error => console.warn('Firebase signout warning:', error));
  localStorage.removeItem('nirbhay_user');
}
