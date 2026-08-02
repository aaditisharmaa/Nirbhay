import React, { useState, useEffect } from 'react';
import { Shield, Plus, X } from './Icons';

export default function WeeklyCheckin({ onOpenReport }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const lastCheckin = localStorage.getItem('nirbhay_weekly_checkin');
    const now = Date.now();
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    if (!lastCheckin || (now - parseInt(lastCheckin, 10)) > ONE_WEEK_MS) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('nirbhay_weekly_checkin', Date.now().toString());
    setVisible(false);
  };

  const handleReport = () => {
    handleDismiss();
    onOpenReport();
  };

  if (!visible) return null;

  return (
    <div className="fixed top-28 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-sm z-30 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-4 border border-indigo-100 animate-in slide-in-from-top-4 duration-300">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-xs">
          <Shield className="w-4 h-4" />
          <span>Weekly Community Check-in</span>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-slate-700 font-medium mb-3 leading-relaxed">
        Did you notice anything this week that could make your local area safer for others?
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={handleDismiss}
          className="flex-1 py-2 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
        >
          Skip
        </button>
        <button
          onClick={handleReport}
          className="flex-1 py-2 text-xs font-bold text-white bg-[#0B0F2E] hover:bg-indigo-950 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5 text-indigo-400" />
          <span>Report Hazard</span>
        </button>
      </div>
    </div>
  );
}
