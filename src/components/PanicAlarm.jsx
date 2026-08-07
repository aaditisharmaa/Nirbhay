import React, { useState, useRef, useEffect } from 'react';
import { AlertTriangle } from './Icons';

const STROBE_INTERVAL = 100; // ms

export default function PanicAlarm() {
  const [active, setActive] = useState(false);
  const audioRef = useRef(null);
  const strobeRef = useRef(null);
  const strobeStateRef = useRef(false);

  const startAlarm = () => {
    setActive(true);

    // Play siren audio on loop
    if (audioRef.current) {
      audioRef.current.loop = true;
      audioRef.current.volume = 1.0;
      audioRef.current.play().catch(() => {
        // Autoplay blocked on some browsers — user gesture already happened so this should be fine
      });
    }

    // Strobe effect
    strobeRef.current = setInterval(() => {
      strobeStateRef.current = !strobeStateRef.current;
      document.body.style.backgroundColor = strobeStateRef.current ? '#ffffff' : '#ef4444';
    }, STROBE_INTERVAL);
  };

  const stopAlarm = () => {
    setActive(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    clearInterval(strobeRef.current);
    document.body.style.backgroundColor = '';
  };

  // Always clean up on unmount
  useEffect(() => {
    return () => {
      clearInterval(strobeRef.current);
      document.body.style.backgroundColor = '';
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  return (
    <>
      {/* Hidden audio element — place siren.mp3 in /public */}
      <audio ref={audioRef} src="/siren.mp3" preload="auto" />

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
        <p className="text-[11px] text-rose-500 text-center font-semibold animate-pulse">
          🚨 Alarm active — tap to stop
        </p>
      )}
    </>
  );
}
