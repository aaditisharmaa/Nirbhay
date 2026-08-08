import React, { useState, useEffect } from 'react';
import { Phone, Shield, X, MapPin, CheckCircle, PhoneCall } from './Icons';
import { authenticatedHeaders } from '../utils/api';

export default function EmergencyContactModal({ user, onComplete, onSkip }) {
  // Up to 3 contact slots
  const [phones, setPhones]   = useState(['', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [saved, setSaved]     = useState(false);
  // Share location state
  const [sharing, setSharing]   = useState(false);
  const [shareStatus, setShareStatus] = useState('');

  // Pre-fill from user object if contacts already exist
  useEffect(() => {
    const existing = user?.emergency_contacts ?? (user?.emergency_contact ? [user.emergency_contact] : []);
    if (existing.length > 0) {
      setPhones([existing[0] ?? '', existing[1] ?? '', existing[2] ?? '']);
    }
  }, [user]);

  const setPhone = (idx, val) => {
    const next = [...phones];
    next[idx] = val;
    setPhones(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const filled = phones.map(p => p.trim()).filter(Boolean);
    if (filled.length === 0) { setError('Add at least one phone number.'); return; }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/emergency-contact', {
        method: 'POST',
        headers: await authenticatedHeaders(),
        body: JSON.stringify({ phones: filled })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save contacts.');
      setSaved(true);
      setTimeout(() => onComplete(data.phones ?? filled), 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Share live location to all saved contacts via WhatsApp / native share
  const handleShareLocation = async () => {
    const filled = phones.map(p => p.trim()).filter(Boolean);
    setSharing(true);
    setShareStatus('');
    try {
      if (!navigator.geolocation) throw new Error('Geolocation not supported.');
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        const text = `📍 I'm sharing my live location with you: ${mapsUrl}`;

        if (navigator.share) {
          await navigator.share({ title: 'My Location', text, url: mapsUrl });
          setShareStatus('Shared!');
        } else {
          await navigator.clipboard.writeText(text);
          setShareStatus('Link copied — paste it in WhatsApp or SMS.');
        }
      }, () => { setShareStatus('Could not get location. Please allow location access.'); },
      { enableHighAccuracy: true, timeout: 8000 });
    } catch (err) {
      if (err.name !== 'AbortError') setShareStatus(err.message);
    } finally {
      setSharing(false);
    }
  };

  const labels = ['Primary Guardian', 'Secondary Contact', 'Third Contact (optional)'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 border border-slate-100 animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
            <Shield className="w-5 h-5" />
            Emergency Guardian Setup
          </div>
          <button onClick={onSkip} className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <h3 className="text-lg font-extrabold text-slate-900">Add Emergency Contacts</h3>
        <p className="text-xs text-slate-500 mt-1 mb-5 leading-relaxed">
          When you trigger SOS, your live location is sent to all saved numbers. Add up to 3 trusted contacts. Nearby Nirbhay users within 1 km are also notified automatically.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {phones.map((ph, i) => (
            <div key={i}>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
                {labels[i]}
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="tel"
                  value={ph}
                  onChange={e => setPhone(i, e.target.value)}
                  placeholder={i === 0 ? '+91 98765 43210 (required)' : '+91 98765 43210'}
                  required={i === 0}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          ))}

          {error && <p className="text-xs text-rose-600 font-semibold bg-rose-50 px-3 py-2 rounded-xl">{error}</p>}

          {/* Share live location now */}
          <button
            type="button"
            onClick={handleShareLocation}
            disabled={sharing}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-all"
          >
            <MapPin className="w-4 h-4" />
            {sharing ? 'Getting location…' : 'Share My Location Now'}
          </button>
          {shareStatus && (
            <p className="text-[11px] text-center text-slate-500">{shareStatus}</p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button type="button" onClick={onSkip}
              className="flex-1 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">
              Skip for Now
            </button>
            <button type="submit" disabled={loading || saved}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
              {saved
                ? <><CheckCircle className="w-4 h-4" /> Saved!</>
                : loading ? 'Saving…' : 'Save Contacts'
              }
            </button>
          </div>
        </form>

        <p className="text-[10px] text-slate-400 text-center mt-4 leading-relaxed">
          🔒 Numbers are stored securely and never shown publicly. Used only for SOS alerts.
        </p>
      </div>
    </div>
  );
}
