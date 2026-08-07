import React, { useState, useRef, useEffect } from 'react';
import { AlertTriangle } from './Icons';

const STROBE_INTERVAL = 100;

// Generates a wailing siren sound using Web Audio API — no audio file needed
function createSirenNode(ctx) {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(600, ctx.currentTime);
  gainNode.gain.setValueAtTime(0.6, ctx.currentTime);

  // Wail: sweep up and down repeatedly
  const wailDuration = 0.8;
  for (let i = 0; i < 30; i++) {
    const t = ctx.currentTime + i * wailDuration;
    oscillator.frequency.linearRampToValueAtTime(1100, t + wailDuration / 2);
    oscillator.frequency.linearRampToValueAtTime(600, t + wailDuration);
  }

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  return { oscillator, gainNode };
}

export default function PanicAlarm() {
  const [active, setActive] = useState(false);
  const strobeRef = useRef(null);
  const strobeStateRef = useRef(false);
  const audioCtxRef = useRef(null);
  const sirenRef = useRef(null);

  const startAlarm = () => {
    setActive(true);

    // Web Audio siren
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const { oscillator, gainNode } = createSirenNode(ctx);
      sirenRef.current = { oscillator, gainNode };
      oscillator.start();
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }

    // Strobe effect
    strobeRef.current = setInterval(() => {
      strobeStateRef.current = !strobeStateRef.current;
      document.body.style.backgroundColor = strobeStateRef.current ? '#ffffff' : '#ef4444';
    }, STROBE_INTERVAL);
  };

  const stopAlarm = () => {
    setActive(false);

    // Stop siren
    try {
      if (sirenRef.current) {
        sirenRef.current.oscillator.stop();
        sirenRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    } catch (e) {}

    // Stop strobe
    clearInterval(strobeRef.current);
    document.body.style.backgroundColor = '';
  };

  useEffect(() => {
    return () => {
      clearInterval(strobeRef.current);
      document.body.style.backgroundColor = '';
      try {
        if (sirenRef.current) sirenRef.current.oscillator.stop();
        if (audioCtxRef.current) audioCtxRef.current.close();
      } catch (e) {}
    };
  }, []);

  return (
    <>
      <button
        onClick={active ? stopAlarm : startAlarm}
        className={`w-full flex items-center justify-center gap-2 py-3 px-4 font-extrabold text-sm rounded-2xl shadow-md active:scale-95 transition-all
          ${active
            ? 'bg-slate-900 text-white border-2 border-rose-500 animate-pulse'
            : 'bg-rose-600 hover:bg-rose-700 text-white'
          }
        `}
      >
        <AlertTriangle className={`w-4 h-4 ${active ? 'animate-bounce' : ''}`} />
        {active ? 'STOP ALARM' : 'Panic Alarm'}
      </button>

      {active && (
        <p className="text-[11px] text-rose-500 text-center font-semibold animate-pulse mt-1">
          🚨 Alarm active — tap to stop
        </p>
      )}
    </>
  );
}
