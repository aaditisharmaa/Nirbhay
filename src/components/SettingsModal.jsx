import React, { useState } from 'react';
import { Phone, Lock, LogOut, Shield, X, User } from './Icons';
import { signOutUser } from '../utils/firebase';
import { authenticatedHeaders } from '../utils/api';

export default function SettingsModal({ user, onUpdateUser, onSignOut, onClose }) {
  const [phone, setPhone] = useState(user?.emergency_contact || '');
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSavePhone = async (e) => {
    e.preventDefault();
    if (!phone) return;

    setLoading(true);
    setSavedSuccess(false);

    try {
      const response = await fetch('/api/auth/emergency-contact', {
        method: 'POST',
        headers: await authenticatedHeaders(),
        body: JSON.stringify({ phone: phone.trim() })
      });
      if (!response.ok) throw new Error('Could not update emergency contact.');

      const updatedUser = { ...user, emergency_contact: phone.trim() };
      localStorage.setItem('nirbhay_user', JSON.stringify(updatedUser));
      onUpdateUser(updatedUser);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Update phone error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    onSignOut();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 border border-slate-100">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-sm">
            <Shield className="w-5 h-5" />
            <span>Profile & Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-sm shadow-md">
            {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-sm font-extrabold text-slate-900 truncate">{user?.displayName || 'Community Guardian'}</h4>
            <p className="text-xs text-slate-500 truncate">{user?.email || 'demouser@nirbhay.org'}</p>
          </div>
        </div>

        {/* Emergency Contact Form */}
        <form onSubmit={handleSavePhone} className="space-y-3 mb-6">
          <label className="block text-xs font-bold text-slate-700">
            Emergency Contact Number
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Save Emergency Contact'}
          </button>

          {savedSuccess && (
            <p className="text-[11px] font-bold text-emerald-600 text-center">
              ✓ Contact updated successfully!
            </p>
          )}
        </form>

        {/* Anonymity Promise */}
        <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 p-3 rounded-2xl mb-5">
          <Lock className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Your profile and email address are never exposed on any public safety report or zone telemetry.
          </p>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs rounded-xl border border-rose-200 transition-all flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>

      </div>
    </div>
  );
}
