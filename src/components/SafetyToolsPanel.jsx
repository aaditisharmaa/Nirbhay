import React, { useState } from 'react';
import { Shield, X, ChevronUp, ChevronDown } from './Icons';
import HoldToConfirmSOS from './HoldToConfirmSOS';
import LiveLocationShare from './LiveLocationShare';
import FakeIncomingCall from './FakeIncomingCall';
import PanicAlarm from './PanicAlarm';
import { authenticatedHeaders } from '../utils/api';

export default function SafetyToolsPanel({ userLocation, user, onSOSTriggered }) {
  const [open, setOpen] = useState(false);

  const handleSOSTriggered = async () => {
    onSOSTriggered && onSOSTriggered();
    // Fire the SOS API call the same way as SosButton does
    try {
      const payload = {
        lat: userLocation?.lat || 28.6328,
        lng: userLocation?.lng || 77.2195,
      };
      await fetch('/api/sos', {
        method: 'POST',
        headers: await authenticatedHeaders(),
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Hold-SOS dispatch error:', err);
    }
  };

  return (
    <>
      {/* Floating toggle button — bottom right */}
      <div className="fixed bottom-8 right-5 z-20">
        <button
          onClick={() => setOpen(prev => !prev)}
          className="flex items-center gap-2 px-4 py-3 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs uppercase tracking-wider rounded-full shadow-xl border-2 border-white transition-all active:scale-95"
          title="Safety Tools"
        >
          <Shield className="w-4 h-4" />
          <span>Safety Tools</span>
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
      </div>

      {/* Slide-up panel */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center pointer-events-none">
          <div className="w-full max-w-sm pointer-events-auto bg-white rounded-t-3xl shadow-2xl border border-slate-100 animate-in slide-in-from-bottom duration-300">

            {/* Handle + header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-2 text-slate-800">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span className="font-extrabold text-sm">Safety Tools</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drag handle pill */}
            <div className="flex justify-center mb-2">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            {/* 2×2 grid of tools */}
            <div className="grid grid-cols-2 gap-3 px-4 pb-8 pt-2">

              {/* Card wrapper */}
              {[
                {
                  label: 'Hold-to-SOS',
                  subtitle: 'Hold 3s to send emergency alert',
                  content: <HoldToConfirmSOS onSOSTriggered={handleSOSTriggered} />,
                },
                {
                  label: 'Share Location',
                  subtitle: 'Send your live GPS link',
                  content: <LiveLocationShare />,
                },
                {
                  label: 'Fake Call',
                  subtitle: 'Trigger a fake incoming call',
                  content: <FakeIncomingCall />,
                },
                {
                  label: 'Panic Alarm',
                  subtitle: 'Loud siren + strobe effect',
                  content: <PanicAlarm />,
                },
              ].map(({ label, subtitle, content }) => (
                <div
                  key={label}
                  className="flex flex-col gap-2 bg-slate-50 border border-slate-100 rounded-2xl p-3 shadow-sm"
                >
                  <div>
                    <p className="text-xs font-extrabold text-slate-800">{label}</p>
                    <p className="text-[10px] text-slate-400 leading-tight">{subtitle}</p>
                  </div>
                  <div className="flex-1 flex items-end">
                    {content}
                  </div>
                </div>
              ))}

            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
