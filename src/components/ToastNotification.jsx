import React, { useEffect } from 'react';
import { AlertTriangle, X } from './Icons';

export default function ToastNotification({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4500);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!message) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#0B0F2E] text-white px-4 py-2.5 rounded-full shadow-2xl border border-indigo-500/40 flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-300 pointer-events-auto max-w-sm w-full mx-4">
      <AlertTriangle className="w-4 h-4 text-indigo-400 flex-shrink-0" />
      <p className="text-xs font-semibold text-indigo-50 truncate flex-1">{message}</p>
      <button onClick={onClose} className="p-0.5 text-slate-400 hover:text-white rounded-full">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
