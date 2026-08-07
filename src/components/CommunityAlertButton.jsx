import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Radio } from './Icons';
import { authenticatedHeaders } from '../utils/api';

const PRESET_MESSAGES = [
  "I'm feeling unsafe in this area. Please stay alert.",
  "Suspicious activity spotted nearby. Be cautious.",
  "Poor lighting and isolated stretch ahead. Watch out.",
  "I feel I'm being followed. Stay aware.",
  "Unsafe crowd situation nearby. Avoid this area.",
];

export default function CommunityAlertButton({ userLocation }) {
  const [phase, setPhase] = useState('idle'); // idle | compose | sending | sent | error
  const [selectedMsg, setSelectedMsg] = useState(PRESET_MESSAGES[0]);
  const [customMsg, setCustomMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [cooldown, setCooldown] = useState(false);

  const finalMessage = customMsg.trim() || selectedMsg;

  const sendAlert = async () => {
    if (cooldown) return;
    setPhase('sending');
    setErrorMsg('');
    try {
      const res = await fetch('/api/community-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await authenticatedHeaders()),
        },
        body: JSON.stringify({
          lat: userLocation?.lat || 28.6328,
          lng: userLocation?.lng || 77.2195,
          message: finalMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to send alert.');
      setPhase('sent');
      // 5-minute cooldown to prevent spam
      setCooldown(true);
      setTimeout(() => {
        setCooldown(false);
        setPhase('idle');
        setCustomMsg('');
        setSelectedMsg(PRESET_MESSAGES[0]);
      }, 5 * 60 * 1000);
    } catch (err) {
      setErrorMsg(err.message);
      setPhase('error');
    }
  };

  if (phase === 'sent') {
    return (
      <div className="w-full p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-extrabold text-emerald-800">Alert sent to nearby users!</p>
          <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
            All Nirbhay users within 1km have been notified. You can send another alert in 5 minutes.
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'idle' || phase === 'error') {
    return (
      <div className="flex flex-col gap-2">
        {phase === 'error' && (
          <p className="text-[11px] text-rose-600 font-semibold bg-rose-50 px-3 py-2 rounded-xl">{errorMsg}</p>
        )}
        <button
          onClick={() => setPhase('compose')}
          disabled={cooldown}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm rounded-2xl shadow-md active:scale-95 transition-all disabled:opacity-50"
        >
          <Radio className="w-4 h-4 animate-pulse" />
          Alert Nearby Users
        </button>
        {cooldown && (
          <p className="text-[11px] text-slate-400 text-center">Cooldown active — you can send again in 5 minutes.</p>
        )}
      </div>
    );
  }

  if (phase === 'compose') {
    return (
      <div className="flex flex-col gap-3">
        {/* Preset messages */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Choose a message</p>
          {PRESET_MESSAGES.map((msg) => (
            <button
              key={msg}
              onClick={() => { setSelectedMsg(msg); setCustomMsg(''); }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all border
                ${selectedMsg === msg && !customMsg.trim()
                  ? 'bg-amber-50 border-amber-400 text-amber-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-amber-300'
                }`}
            >
              {msg}
            </button>
          ))}
        </div>

        {/* Custom message */}
        <div>
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Or write your own</p>
          <textarea
            value={customMsg}
            onChange={e => setCustomMsg(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="Describe what you're experiencing…"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
          <p className="text-[10px] text-slate-400 text-right mt-0.5">{(customMsg || '').length}/200</p>
        </div>

        {/* Preview */}
        <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider mb-1">Preview</p>
          <p className="text-xs text-amber-900 font-semibold leading-relaxed">"{finalMessage}"</p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => { setPhase('idle'); setCustomMsg(''); }}
            className="flex-1 py-2.5 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            onClick={sendAlert}
            className="flex-1 py-2.5 text-xs font-extrabold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Send to Nearby
          </button>
        </div>
      </div>
    );
  }

  // sending phase
  return (
    <div className="w-full py-3 flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl">
      <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-bold text-amber-700">Broadcasting alert…</span>
    </div>
  );
}
