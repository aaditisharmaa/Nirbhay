import React from 'react';
import { GuardianShieldIcon, Compass, Navigation, Settings, Radio } from './Icons';

export default function TopHeader({ mode, onModeChange, locationStatus, onOpenSettings, onToggleFeed, isFeedOpen }) {
  const getBadgeStyle = (level) => {
    switch (level) {
      case 'High':
        return 'bg-rose-50 border-rose-200 text-rose-700';
      case 'Moderate':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      default:
        return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    }
  };

  const getDotStyle = (level) => {
    switch (level) {
      case 'High': return 'bg-rose-500 animate-ping';
      case 'Moderate': return 'bg-amber-500';
      default: return 'bg-emerald-500';
    }
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-30 p-3 sm:p-4 flex flex-col gap-2 pointer-events-none">
      
      {/* Upper Control Bar */}
      <div className="flex items-center justify-between gap-2 pointer-events-auto">
        
        {/* Brand Badge */}
        <div className="flex items-center gap-2 bg-[#0B0F2E] text-white px-3.5 py-2 rounded-2xl shadow-lg border border-indigo-900/50">
          <GuardianShieldIcon className="w-5 h-5 text-indigo-400" />
          <span className="font-extrabold text-sm tracking-wider uppercase font-sans">Nirbhay</span>
        </div>

        {/* Mode Toggle Switch */}
        <div className="flex items-center bg-white/95 backdrop-blur-md p-1 rounded-2xl shadow-lg border border-slate-200/80">
          <button
            onClick={() => onModeChange('explore')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              mode === 'explore'
                ? 'bg-[#0B0F2E] text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Explore</span>
          </button>
          
          <button
            onClick={() => onModeChange('route')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              mode === 'route'
                ? 'bg-[#0B0F2E] text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Route</span>
          </button>
        </div>

        {/* Action Controls: Live Feed & Settings */}
        <div className="flex items-center gap-1.5">
          {/* Live Feed Toggle Button */}
          <button
            onClick={onToggleFeed}
            className={`p-2.5 backdrop-blur-md rounded-2xl shadow-lg border transition-all active:scale-95 flex items-center justify-center ${
              isFeedOpen 
                ? 'bg-indigo-600 text-white border-indigo-700'
                : 'bg-white/95 text-slate-700 hover:bg-slate-100 border-slate-200/80'
            }`}
            title="Toggle Live Telemetry Feed"
          >
            <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
          </button>

          {/* Settings Icon */}
          <button
            onClick={onOpenSettings}
            className="p-2.5 bg-white/95 backdrop-blur-md hover:bg-slate-100 text-slate-700 rounded-2xl shadow-lg border border-slate-200/80 transition-all active:scale-95"
            title="Settings & Emergency Contact"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Live Location Risk Banner */}
      <div className="pointer-events-auto self-center max-w-full">
        <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold shadow-md backdrop-blur-md transition-all ${getBadgeStyle(locationStatus.level)}`}>
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${getDotStyle(locationStatus.level)}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${getDotStyle(locationStatus.level)}`} />
          </span>
          <span>
            {locationStatus.denied 
              ? 'Default City View (Enable GPS for live Telemetry)'
              : `Live Location: ${locationStatus.level}-Risk Area (${locationStatus.score}/100)`}
          </span>
        </div>
      </div>

    </header>
  );
}
