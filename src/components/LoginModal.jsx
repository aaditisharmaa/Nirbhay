import React, { useState } from 'react';
import { getAuthHeaders, isFirebaseConfigured, signInWithEmail, signInWithGoogle } from '../utils/firebase';
import { GuardianShieldIcon, Lock } from './Icons';

export default function LoginModal({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  const runSignIn = async (getUser) => {
    setLoading(true); setError(null);
    try {
      const user = await getUser();
      const response = await fetch('/api/auth/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) } });
      if (!response.ok) throw new Error('Could not verify your sign-in with the safety service.');
      const data = await response.json();
      const loggedUser = data?.user || user;
      localStorage.setItem('nirbhay_user', JSON.stringify(loggedUser));
      onLoginSuccess(loggedUser);
    } catch (err) {
      console.error('Sign-in error:', err);
      setError(err.message || 'Could not sign in. Please try again.');
    } finally { setLoading(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0F2E]/80 backdrop-blur-md">
    <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-7 border border-slate-100 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 mb-4 shadow-inner"><GuardianShieldIcon className="w-8 h-8" /></div>
      <h2 className="text-2xl font-extrabold text-slate-900">Welcome to Nirbhay</h2>
      <p className="text-xs text-slate-500 font-medium mt-1 mb-5">Danger can be anywhere. Be your own guardian angel.</p>
      {!isFirebaseConfigured && <div className="mb-4 text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-lg">Sign-in setup is incomplete. Add the Firebase values in Render, then redeploy.</div>}
      {error && <div className="mb-4 text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-lg">{error}</div>}
      <button onClick={() => runSignIn(signInWithGoogle)} disabled={loading || !isFirebaseConfigured} className="w-full py-3 bg-[#0B0F2E] text-white font-semibold text-sm rounded-xl shadow-lg disabled:opacity-50">Continue with Google</button>
      <div className="flex items-center gap-3 my-4 text-[10px] font-bold uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" /></div>
      <form onSubmit={(event) => { event.preventDefault(); runSignIn(() => signInWithEmail(email.trim(), password, isCreatingAccount)); }} className="space-y-2.5 text-left">
        <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email address" required disabled={loading || !isFirebaseConfigured} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm disabled:opacity-50" />
        <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Password (6+ characters)" minLength="6" required disabled={loading || !isFirebaseConfigured} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm disabled:opacity-50" />
        <button type="submit" disabled={loading || !isFirebaseConfigured} className="w-full py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl disabled:opacity-50">{isCreatingAccount ? 'Create account' : 'Sign in with email'}</button>
      </form>
      <button type="button" onClick={() => setIsCreatingAccount(value => !value)} className="mt-3 text-xs font-semibold text-indigo-600">{isCreatingAccount ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
      <div className="mt-5 flex items-start gap-2 text-left bg-slate-50 p-3 rounded-xl border border-slate-100"><Lock className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" /><p className="text-[11px] text-slate-600 leading-relaxed"><span className="font-semibold text-slate-900">Public anonymity:</span> your account is used only for spam prevention and is never shown on a report or map zone.</p></div>
    </div>
  </div>;
}
