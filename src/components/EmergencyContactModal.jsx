import React, { useState } from 'react';
import { Phone, Shield, X } from './Icons';

export default function EmergencyContactModal({ user, onComplete, onSkip }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone || phone.trim().length < 8) return;

    setLoading(true);
    try {
      await fetch('/api/auth/emergency-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, phone: phone.trim() })
      });
      onComplete(phone.trim());
    } catch (err) {
      console.error('Save contact error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 border border-slate-100 animate-in fade-in zoom-in duration-200">
        
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
            <Shield className="w-5 h-5" />
            <span>Emergency Guardian Setup</span>
          </div>
          <button 
            onClick={onSkip}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h3 className="text-lg font-extrabold text-slate-900">Add an Emergency Contact</h3>
        <p className="text-xs text-slate-500 mt-1 mb-5">
          If you ever trigger the SOS alert button, we will instantly send your live location telemetry and safety risk status to this phone number.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Trusted Phone Number (with Country Code)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onSkip}
              className="flex-1 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            >
              Skip for Now
            </button>
            <button
              type="submit"
              disabled={loading || !phone}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Guardian'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
