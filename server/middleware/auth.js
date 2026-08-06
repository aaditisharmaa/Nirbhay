import admin from 'firebase-admin';

let initialized = false;

function initializeFirebaseAdmin() {
  if (initialized) return true;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccount) return false;

  try {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(serviceAccount)) });
    initialized = true;
    return true;
  } catch (error) {
    console.error('Firebase Admin initialization failed:', error.message);
    return false;
  }
}

export async function requireAuthenticatedUser(req, res, next) {
  const developmentUserId = req.get('x-development-user');
  // The Vite client creates this identifier only in development when Firebase is
  // not configured. Never accept it in production.
  if (process.env.NODE_ENV !== 'production' && developmentUserId?.startsWith('dev_user_')) {
    req.user = { uid: developmentUserId, email: 'dev@nirbhay.local', name: 'Development User' };
    return next();
  }

  const authHeader = req.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token || !initializeFirebaseAdmin()) {
    return res.status(401).json({ error: 'Sign in is required for this action.' });
  }

  try {
    req.user = await admin.auth().verifyIdToken(token, true);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}
