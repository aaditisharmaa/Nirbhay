import React from 'react';
import { Settings, Navigation, Compass } from './Icons';

/**
 * TopHeader — Explore / Route mode toggle + app logo + settings.
 * Props:
 *   mode          'explore' | 'route'
 *   onModeChange  (mode: string) => void
 *   locationStatus { level: string, score: number }
 *   onOpenSettings () => void
 */
export default function TopHeader({ mode = 'explore', onModeChange, locationStatus, onOpenSettings }) {
  const isHighRisk = locationStatus?.level === 'High';
  const isMod      = locationStatus?.level === 'Moderate';

  const statusColor = isHighRisk ? '#f43f5e' : isMod ? '#f59e0b' : '#22c55e';
  const statusLabel = locationStatus?.level
    ? `Live Location: ${locationStatus.level}-Risk Area (${locationStatus.score ?? '–'}/100)`
    : 'Acquiring location…';

  return (
    <header className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 bg-gradient-to-b from-[#090d24]/90 via-[#090d24]/60 to-transparent pointer-events-auto">

        {/* App wordmark */}
        <span className="font-extrabold text-base tracking-widest text-white uppercase select-none drop-shadow">
          NIRBHAY
        </span>

        {/* Explore / Route toggle pill */}
        <div className="flex items-center bg-[#0d1330]/90 backdrop-blur-md p-1 rounded-full border border-slate-700/60 shadow-xl">
          <button
            onClick={() => onModeChange && onModeChange('explore')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black tracking-wide transition-all duration-200 ${
              mode === 'explore'
                ? 'bg-amber-400 text-slate-950 shadow-[0_0_10px_rgba(251,191,36,0.45)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Explore
          </button>
          <button
            onClick={() => onModeChange && onModeChange('route')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black tracking-wide transition-all duration-200 ${
              mode === 'route'
                ? 'bg-amber-400 text-slate-950 shadow-[0_0_10px_rgba(251,191,36,0.45)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            Route
          </button>
        </div>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-all active:scale-95"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Live risk status pill */}
      <div className="flex justify-center mt-0.5 pointer-events-none">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-[11px] font-semibold backdrop-blur-sm shadow"
          style={{ background: 'rgba(9,13,36,0.75)', border: `1px solid ${statusColor}40` }}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }}
          />
          {statusLabel}
        </div>
      </div>
    </header>
  );
}
