import React, { useState, useRef, useCallback } from 'react';
import { AlertTriangle, Shield, CheckCircle, Phone, PhoneCall, X, Radio, MapPin } from './Icons';
import { authenticatedHeaders } from '../utils/api';

const HOLD_DURATION = 3000;

export default function SosButton({ userLocation, user, onPromptEmergencyContact, isHighRisk = false }) {
  const [activeState, setActiveState] = useState('idle'); // idle | holding | alerting | confirmed
  const [progress, setProgress] = useState(0); // 0–1
  const [sosDetails, setSosDetails] = useState(null);

  const startTimeRef = useRef(null);
  const rafRef = useRef(null);
  const holdActiveRef = useRef(false);

  const tick = useCallback(() => {
    if (!holdActiveRef.current) return;
    const elapsed = Date.now() - startTimeRef.current;
    const p = Math.min(elapsed / HOLD_DURATION, 1);
    setProgress(p);
    if (p >= 1) {
      holdActiveRef.current = false;
      setProgress(0);
      triggerSos();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startHold = useCallback((e) => {
    e.preventDefault();
    if (activeState !== 'idle') return;

    // Check any contact exists (new multi-contact or legacy single)
    const contacts = user?.emergency_contacts ?? (user?.emergency_contact ? [user.emergency_contact] : []);
    if (contacts.length === 0) {
      onPromptEmergencyContact();
      return;
    }

    holdActiveRef.current = true;
    startTimeRef.current = Date.now();
    setActiveState('holding');
    setProgress(0);
    rafRef.current = requestAnimationFrame(tick);
  }, [activeState, user, tick]);

  const cancelHold = useCallback(() => {
    if (!holdActiveRef.current) return;
    holdActiveRef.current = false;
    cancelAnimationFrame(rafRef.current);
    setActiveState('idle');
    setProgress(0);
  }, []);

  const triggerSos = async () => {
    setActiveState('alerting');
    try {
      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: await authenticatedHeaders(),
        body: JSON.stringify({
          lat: userLocation.lat || 28.6328,
          lng: userLocation.lng || 77.2195,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to dispatch SOS alert');
      setSosDetails(data);
      setActiveState('confirmed');
    } catch (err) {
      console.error('SOS dispatch error:', err);
      setActiveState('idle');
    }
  };

  const isHolding = activeState === 'holding';

  return (
    <>
      {/* Floating SOS button — bottom left, pill shape */}
      <div className="fixed bottom-8 left-5 z-20 select-none">
        <button
          onMouseDown={startHold}
          onMouseUp={cancelHold}
          onMouseLeave={cancelHold}
          onTouchStart={startHold}
          onTouchEnd={cancelHold}
          onTouchCancel={cancelHold}
          disabled={activeState === 'alerting'}
          className={`relative flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-extrabold text-xs uppercase tracking-wider transition-all disabled:opacity-60 overflow-hidden ${isHolding ? 'scale-95' : 'active:scale-95'}`}
          style={{
            background: isHighRisk
              ? 'rgba(190,18,60,0.92)'
              : 'rgba(127,17,47,0.88)',
            border: `1px solid ${isHighRisk ? 'rgba(251,113,133,0.7)' : 'rgba(251,113,133,0.4)'}`,
            boxShadow: isHighRisk
              ? '0 0 20px rgba(225,29,72,0.55)'
              : '0 0 10px rgba(225,29,72,0.25)',
            backdropFilter: 'blur(8px)',
          }}
          aria-label="Hold 3 seconds to trigger SOS"
        >
          {/* Progress fill overlay */}
          {isHolding && (
            <span
              className="absolute inset-0 bg-white/20 origin-left"
              style={{ transform: `scaleX(${progress})`, transition: 'none' }}
            />
          )}
          <Radio className={`w-4 h-4 relative z-10 ${isHolding ? 'animate-ping' : isHighRisk ? 'animate-pulse' : ''}`} />
          <span className="relative z-10">
            {isHolding ? `Hold… ${Math.ceil((1 - progress) * 3)}s` : 'SOS Emergency'}
          </span>
        </button>
        {isHighRisk && !isHolding && (
          <div className="absolute inset-0 rounded-full bg-rose-600/20 animate-ping pointer-events-none" />
        )}
      </div>

      {/* Alerting / Confirmed overlay */}
      {(activeState === 'alerting' || activeState === 'confirmed') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center border border-slate-100">

            {activeState === 'alerting' ? (
              <div className="py-6 space-y-4">
                <div className="relative inline-flex items-center justify-center">
                  <div className="w-20 h-20 bg-rose-100 rounded-full animate-ping absolute" />
                  <div className="w-16 h-16 bg-rose-600 text-white rounded-full flex items-center justify-center relative shadow-lg">
                    <Radio className="w-8 h-8 animate-pulse" />
                  </div>
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">Alerting Emergency Contacts…</h3>
                <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto">
                  Capturing live location telemetry & evaluating spatial risk factors…
                </p>
                <a
                  href="tel:112"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-bold text-xs"
                  style={{background:'rgba(185,28,28,0.9)',border:'1px solid rgba(252,165,165,0.4)'}}
                >
                  <PhoneCall className="w-4 h-4" /> Call 112 — Police
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">SOS Alert Dispatched</h3>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-left space-y-2">
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-indigo-600" />
                    {sosDetails?.contactsAlerted > 1
                      ? `${sosDetails.contactsAlerted} emergency contacts notified`
                      : 'Emergency contact notified'}
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-mono bg-white p-2 rounded-xl border border-slate-100">
                    "{sosDetails?.messageBody}"
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-center gap-2 text-left">
                  <Shield className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-[11px] text-amber-800">
                    Nirbhay does not contact police automatically. If you are in immediate danger, call your local emergency number now.
                  </p>
                </div>

                <a
                  href="tel:112"
                  className="w-full py-3 flex items-center justify-center gap-2 rounded-xl font-bold text-xs text-white transition-all"
                  style={{background:'rgba(185,28,28,0.9)',border:'1px solid rgba(252,165,165,0.35)'}}
                >
                  <PhoneCall className="w-4 h-4" /> Call 112 — Police Emergency
                </a>

                <button
                  onClick={async () => {
                    const lat = sosDetails?.lat || 28.6328;
                    const lng = sosDetails?.lng || 77.2195;
                    const url = `https://www.google.com/maps?q=${lat},${lng}`;
                    const text = `I need help! My location: ${url}`;
                    if (navigator.share) {
                      try { await navigator.share({ title: 'My Location', text, url }); } catch (_) {}
                    } else {
                      await navigator.clipboard.writeText(text);
                    }
                  }}
                  className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-all flex items-center justify-center gap-2"
                >
                  <MapPin className="w-4 h-4" /> Share Location via WhatsApp / SMS
                </button>

                <button
                  onClick={() => setActiveState('idle')}
                  className="w-full py-3 bg-[#0B0F2E] hover:bg-indigo-950 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                >
                  Dismiss
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
