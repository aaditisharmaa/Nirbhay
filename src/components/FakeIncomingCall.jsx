import React, { useState, useEffect, useRef } from 'react';
import { Phone, X } from './Icons';

const FAKE_CONTACTS = ['Mom', 'Dad', 'Priya', 'Rahul', 'Ananya', 'Best Friend'];
const DELAY_SECONDS = 10;

// Generates a classic double-ring phone ringtone using Web Audio API
function startRingtone(ctxRef, ringTimerRef) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctxRef.current = ctx;

    const playRing = (startTime) => {
      // Two short beeps = one "ring"
      [0, 0.2].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, ctx.currentTime + startTime + offset);
        // Add a slight harmony
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(620, ctx.currentTime + startTime + offset);

        gain.gain.setValueAtTime(0, ctx.currentTime + startTime + offset);
        gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + startTime + offset + 0.02);
        gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + startTime + offset + 0.15);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startTime + offset + 0.18);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + startTime + offset);
        osc2.start(ctx.currentTime + startTime + offset);
        osc.stop(ctx.currentTime + startTime + offset + 0.2);
        osc2.stop(ctx.currentTime + startTime + offset + 0.2);
      });
    };

    // Play immediately then repeat every 2s
    playRing(0);
    ringTimerRef.current = setInterval(() => playRing(0), 2000);
  } catch (e) {
    console.warn('Web Audio not supported:', e);
  }
}

function stopRingtone(ctxRef, ringTimerRef) {
  clearInterval(ringTimerRef.current);
  ringTimerRef.current = null;
  try {
    if (ctxRef.current) {
      ctxRef.current.close();
      ctxRef.current = null;
    }
  } catch (e) {}
}

export default function FakeIncomingCall() {
  const [phase, setPhase] = useState('idle'); // idle | countdown | ringing | active
  const [countdown, setCountdown] = useState(DELAY_SECONDS);
  const [callSeconds, setCallSeconds] = useState(0);
  const [callerName] = useState(() => FAKE_CONTACTS[Math.floor(Math.random() * FAKE_CONTACTS.length)]);

  const countdownRef = useRef(null);
  const callTimerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const ringIntervalRef = useRef(null);

  // Countdown before the call appears
  useEffect(() => {
    if (phase === 'countdown') {
      setCountdown(DELAY_SECONDS);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            setPhase('ringing');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(countdownRef.current);
  }, [phase]);

  // Start / stop ringtone based on phase
  useEffect(() => {
    if (phase === 'ringing') {
      startRingtone(audioCtxRef, ringIntervalRef);
    } else {
      stopRingtone(audioCtxRef, ringIntervalRef);
    }
    return () => stopRingtone(audioCtxRef, ringIntervalRef);
  }, [phase]);

  // Call duration timer
  useEffect(() => {
    if (phase === 'active') {
      setCallSeconds(0);
      callTimerRef.current = setInterval(() => setCallSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(callTimerRef.current);
  }, [phase]);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const dismiss = () => {
    clearInterval(countdownRef.current);
    clearInterval(callTimerRef.current);
    stopRingtone(audioCtxRef, ringIntervalRef);
    setPhase('idle');
  };

  return (
    <>
      {phase === 'idle' && (
        <button
          onClick={() => setPhase('countdown')}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-2xl shadow-md active:scale-95 transition-all"
        >
          <Phone className="w-4 h-4" />
          Trigger Fake Call ({DELAY_SECONDS}s)
        </button>
      )}

      {phase === 'countdown' && (
        <div className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-violet-100 text-violet-700 font-bold text-sm rounded-2xl border border-violet-200">
          <span className="w-5 h-5 text-center font-extrabold">{countdown}</span>
          <span>Fake call incoming…</span>
          <button onClick={dismiss} className="ml-auto text-violet-400 hover:text-violet-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {(phase === 'ringing' || phase === 'active') && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gradient-to-b from-slate-900 to-slate-800 text-white py-16 px-6 animate-in fade-in duration-300">

          {/* Caller info */}
          <div className="flex flex-col items-center gap-4 mt-8">
            <div className={`w-28 h-28 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-5xl shadow-2xl
              ${phase === 'ringing' ? 'ring-4 ring-white/30 animate-pulse' : ''}`}>
              {callerName.charAt(0)}
            </div>
            <p className="text-3xl font-extrabold">{callerName}</p>
            <p className="text-slate-400 text-sm font-medium">
              {phase === 'ringing' ? 'Incoming call…' : formatTime(callSeconds)}
            </p>
            {phase === 'ringing' && (
              <p className="text-xs text-slate-500 animate-pulse">Mobile · India</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-around w-full max-w-xs">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={dismiss}
                className="w-16 h-16 bg-rose-600 hover:bg-rose-700 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all"
                aria-label="Decline"
              >
                <X className="w-7 h-7" />
              </button>
              <span className="text-xs text-slate-400">{phase === 'active' ? 'End' : 'Decline'}</span>
            </div>

            {phase === 'ringing' && (
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => setPhase('active')}
                  className="w-16 h-16 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all"
                  aria-label="Accept"
                >
                  <Phone className="w-7 h-7" />
                </button>
                <span className="text-xs text-slate-400">Accept</span>
              </div>
            )}
          </div>

        </div>
      )}
    </>
  );
}
