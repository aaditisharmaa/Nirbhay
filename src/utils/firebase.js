import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

let auth = null;
let provider = null;

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 5) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
  }
} catch (e) {
  console.warn('Firebase init notice:', e.message);
}

/**
 * Executes real Google Sign-In via Firebase Auth
 */
export async function signInWithGoogle() {
  if (auth && provider) {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      return {
        id: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        photoURL: user.photoURL,
        token: await user.getIdToken()
      };
    } catch (err) {
      console.error('Real Firebase Google Auth error:', err);
      throw new Error(`Google Sign-In failed: ${err.message}`);
    }
  }

  if (import.meta.env.DEV) {
    console.warn('Firebase is not configured; using development-only session.');
    return { id: `dev_user_${crypto.randomUUID()}`, email: 'dev@nirbhay.local', displayName: 'Development User', isDevelopmentUser: true };
  }

  throw new Error('Google sign-in is not configured. Please contact the app administrator.');
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
  if (auth) {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Firebase signout warning:', e);
    }
  }
  localStorage.removeItem('nirbhay_user');
}
