import React, { useState, useRef, useCallback } from 'react';
import { Radio } from './Icons';

const HOLD_DURATION = 3000; // ms
const RADIUS = 44; // SVG circle radius
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function HoldToConfirmSOS({ onSOSTriggered }) {
  const [progress, setProgress] = useState(0); // 0–1
  const [holding, setHolding] = useState(false);
  const [fired, setFired] = useState(false);

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
      setHolding(false);
      setFired(true);
      onSOSTriggered && onSOSTriggered();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onSOSTriggered]);

  const startHold = useCallback((e) => {
    e.preventDefault();
    if (fired) return;
    holdActiveRef.current = true;
    startTimeRef.current = Date.now();
    setHolding(true);
    setProgress(0);
    rafRef.current = requestAnimationFrame(tick);
  }, [fired, tick]);

  const cancelHold = useCallback(() => {
    if (!holdActiveRef.current) return;
    holdActiveRef.current = false;
    cancelAnimationFrame(rafRef.current);
    setHolding(false);
    setProgress(0);
  }, []);

  const reset = () => {
    setFired(false);
    setProgress(0);
    setHolding(false);
  };

  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative select-none" style={{ width: 120, height: 120 }}>
        {/* Background track */}
        <svg className="absolute inset-0 -rotate-90" width="120" height="120">
          <circle
            cx="60" cy="60" r={RADIUS}
            fill="none"
            stroke="#fecaca"
            strokeWidth="6"
          />
          {/* Progress ring */}
          <circle
            cx="60" cy="60" r={RADIUS}
            fill="none"
            stroke="#dc2626"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: holding ? 'none' : 'stroke-dashoffset 0.3s ease' }}
          />
        </svg>

        {/* Button */}
        <button
          onMouseDown={startHold}
          onMouseUp={cancelHold}
          onMouseLeave={cancelHold}
          onTouchStart={startHold}
          onTouchEnd={cancelHold}
          onTouchCancel={cancelHold}
          disabled={fired}
          className={`absolute inset-2 rounded-full flex flex-col items-center justify-center gap-1 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all
            ${fired ? 'bg-emerald-600' : 'bg-rose-600 active:scale-95'}
            ${holding ? 'shadow-[0_0_24px_rgba(220,38,38,0.7)]' : ''}
          `}
          aria-label="Hold to trigger SOS"
        >
          <Radio className={`w-7 h-7 ${holding ? 'animate-ping' : fired ? '' : 'animate-pulse'}`} />
          <span className="text-[10px] leading-tight text-center px-1">
            {fired ? 'SENT!' : holding ? 'HOLD…' : 'HOLD SOS'}
          </span>
        </button>
      </div>

      <p className="text-[11px] text-slate-500 text-center max-w-[140px]">
        {fired
          ? <button onClick={reset} className="text-indigo-600 font-semibold underline">Reset</button>
          : 'Hold 3 seconds to trigger emergency alert'}
      </p>
    </div>
  );
}
