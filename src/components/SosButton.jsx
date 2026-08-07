import React, { useState, useRef, useCallback } from 'react';
import { AlertTriangle, Shield, CheckCircle, Phone, X, Radio } from './Icons';
import { authenticatedHeaders } from '../utils/api';

const HOLD_DURATION = 3000;
const RADIUS = 30;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function SosButton({ userLocation, user, onPromptEmergencyContact }) {
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

    const savedContact = user ? user.emergency_contact : null;
    if (!savedContact) {
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

  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const isHolding = activeState === 'holding';

  return (
    <>
      {/* Floating SOS button — bottom left */}
      <div className="fixed bottom-8 left-5 z-20 select-none">
        <div className="relative flex items-center justify-center" style={{ width: 90, height: 90 }}>

          {/* Outer glow ring — always visible, pulses when idle */}
          <div className={`absolute inset-0 rounded-full bg-rose-600/20 ${isHolding ? '' : 'animate-ping'}`} />

          {/* SVG progress ring */}
          <svg className="absolute inset-0 -rotate-90" width="90" height="90">
            {/* track */}
            <circle cx="45" cy="45" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="5" />
            {/* fill */}
            <circle
              cx="45" cy="45" r={RADIUS}
              fill="none"
              stroke="white"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: isHolding ? 'none' : 'stroke-dashoffset 0.3s ease' }}
            />
          </svg>

          {/* Main button */}
          <button
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={startHold}
            onTouchEnd={cancelHold}
            onTouchCancel={cancelHold}
            disabled={activeState === 'alerting'}
            className={`relative w-[70px] h-[70px] rounded-full flex flex-col items-center justify-center gap-0.5
              bg-rose-600 text-white font-extrabold
              shadow-[0_0_24px_rgba(225,29,72,0.7)]
              border-2 border-white
              transition-transform duration-100 disabled:opacity-60
              ${isHolding ? 'scale-95' : 'active:scale-95'}
            `}
            aria-label="Hold 3 seconds to trigger SOS"
          >
            <Radio className={`w-5 h-5 ${isHolding ? 'animate-ping' : 'animate-pulse'}`} />
            <span className="text-[8px] uppercase tracking-wider leading-none">
              {isHolding ? 'HOLD…' : 'SOS'}
            </span>
          </button>

        </div>

        {/* Label below button */}
        <p className="text-[9px] text-white/70 font-bold uppercase tracking-wider text-center mt-1">
          {isHolding ? 'Keep holding…' : 'Hold 3s'}
        </p>
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
                    Emergency contact notified
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
