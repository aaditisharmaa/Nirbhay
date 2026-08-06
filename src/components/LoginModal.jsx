import React, { useState } from 'react';
import { signInWithGoogle, getAuthHeaders } from '../utils/firebase';
import { GuardianShieldIcon, Lock } from './Icons';

export default function LoginModal({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      
      let loggedUser = user;
      try {
        // Sync user with backend using the verified Firebase session.
        const res = await fetch('/api/auth/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) }
        });
        if (!res.ok) throw new Error('Could not verify your sign-in with the safety service.');
        const data = await res.json();
        if (data?.user) loggedUser = data.user;
      } catch (syncErr) {
        throw syncErr;
      }
      
      localStorage.setItem('nirbhay_user', JSON.stringify(loggedUser));
      onLoginSuccess(loggedUser);
    } catch (err) {
      console.error('Sign in error:', err);
      setError(err.message || 'Could not sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0F2E]/80 backdrop-blur-md">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-7 border border-slate-100 text-center animate-in fade-in zoom-in duration-200">
        
        {/* Brand Icon & Heading */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 mb-4 shadow-inner">
          <GuardianShieldIcon className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Welcome to Nirbhay</h2>
        <p className="text-xs text-slate-500 font-medium mt-1 mb-6">
          Danger can be anywhere. Be your own guardian angel.
        </p>

        {error && (
          <div className="mb-4 text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-lg">
            {error}
          </div>
        )}

        {/* Google Sign-In Button (On-Brand styling) */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-[#0B0F2E] hover:bg-indigo-950 active:scale-[0.98] text-white font-semibold text-sm rounded-xl shadow-lg transition-all disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* Anonymity Promise Note */}
        <div className="mt-6 flex items-start gap-2 text-left bg-slate-50 p-3 rounded-xl border border-slate-100">
          <Lock className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-900">100% Public Anonymity:</span> Your account is used internally for spam prevention only. Your name, email, or photo is <span className="font-semibold text-indigo-700">never shown publicly</span> on any report or map zone.
          </p>
        </div>

      </div>
    </div>
  );
}
