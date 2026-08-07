import React, { useState } from 'react';
import { getAuthHeaders, isFirebaseConfigured, signInWithEmailOnly, signInWithGoogle } from '../utils/firebase';
import { GuardianShieldIcon, Lock } from './Icons';

// Step 1: email entry + Google option
// Step 2: name entry (new users get a default, can customise before proceeding)
export default function LoginModal({ onLoginSuccess }) {
  const [step, setStep] = useState('email'); // 'email' | 'name'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pendingUser, setPendingUser] = useState(null);

  // Derive a friendly default name from the email prefix
  const defaultNameFromEmail = (addr) => {
    const prefix = addr.split('@')[0] || 'Guardian';
    return prefix.charAt(0).toUpperCase() + prefix.slice(1).replace(/[._\-\d]+/g, ' ').trim();
  };

  const syncUser = async (user, headers) => {
    const response = await fetch('/api/auth/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
    });
    if (!response.ok) throw new Error('Could not verify your sign-in with the safety service.');
    const data = await response.json();
    return data?.user || user;
  };

  // Called after email submit or Google
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithEmailOnly(email.trim());
      const headers = await getAuthHeaders();
      const synced = await syncUser(user, headers);
      // If the user already has a stored display name, skip the name step
      if (synced.display_name && synced.display_name !== synced.email?.split('@')[0]) {
        localStorage.setItem('nirbhay_user', JSON.stringify(synced));
        onLoginSuccess(synced);
      } else {
        setPendingUser(synced);
        setDisplayName(synced.displayName || defaultNameFromEmail(email.trim()));
        setStep('name');
      }
    } catch (err) {
      setError(err.message || 'Could not sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { signInWithGoogle: doGoogle } = await import('../utils/firebase');
      const user = await doGoogle();
      const headers = await getAuthHeaders();
      const synced = await syncUser(user, headers);
      localStorage.setItem('nirbhay_user', JSON.stringify(synced));
      onLoginSuccess(synced);
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNameSubmit = async (e) => {
    e.preventDefault();
    const name = displayName.trim() || defaultNameFromEmail(email);
    setLoading(true);
    setError(null);
    try {
      // Persist the chosen name via the API
      const headers = await getAuthHeaders();
      await fetch('/api/auth/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ displayName: name }),
      }).catch(() => {}); // non-fatal — name update is best-effort
      const finalUser = { ...pendingUser, displayName: name, display_name: name };
      localStorage.setItem('nirbhay_user', JSON.stringify(finalUser));
      onLoginSuccess(finalUser);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0F2E]/80 backdrop-blur-md">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-7 border border-slate-100 text-center">

        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 mb-4 shadow-inner">
          <GuardianShieldIcon className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900">Welcome to Nirbhay</h2>
        <p className="text-xs text-slate-500 font-medium mt-1 mb-5">Danger can be anywhere. Be your own guardian angel.</p>

        {!isFirebaseConfigured && (
          <div className="mb-4 text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-lg">
            Sign-in setup is incomplete. Add the Firebase values in Render, then redeploy.
          </div>
        )}

        {error && (
          <div className="mb-4 text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-lg">{error}</div>
        )}

        {/* ── Step 1: Email entry ── */}
        {step === 'email' && (
          <>
            <button
              onClick={handleGoogleSignIn}
              disabled={loading || !isFirebaseConfigured}
              className="w-full py-3 bg-[#0B0F2E] text-white font-semibold text-sm rounded-xl shadow-lg disabled:opacity-50 mb-4"
            >
              {loading ? 'Signing in…' : 'Continue with Google'}
            </button>

            <div className="flex items-center gap-3 mb-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-3 text-left">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                disabled={loading || !isFirebaseConfigured}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm disabled:opacity-50"
                autoFocus
              />
              <button
                type="submit"
                disabled={loading || !isFirebaseConfigured || !email.trim()}
                className="w-full py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl disabled:opacity-50"
              >
                {loading ? 'Please wait…' : 'Continue with email'}
              </button>
            </form>
          </>
        )}

        {/* ── Step 2: Name entry ── */}
        {step === 'name' && (
          <form onSubmit={handleNameSubmit} className="space-y-3 text-left">
            <p className="text-xs text-slate-500 text-center -mt-2 mb-1">
              What should we call you? You can change this any time.
            </p>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={40}
              disabled={loading}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm disabled:opacity-50"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl disabled:opacity-50"
            >
              {loading ? 'Setting up…' : 'Get started'}
            </button>
          </form>
        )}

        <div className="mt-5 flex items-start gap-2 text-left bg-slate-50 p-3 rounded-xl border border-slate-100">
          <Lock className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-900">Public anonymity:</span> your account is used only for spam prevention and is never shown on a report or map zone.
          </p>
        </div>

      </div>
    </div>
  );
}
