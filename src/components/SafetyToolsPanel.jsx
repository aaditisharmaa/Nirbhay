import React, { useState } from 'react';
import { Shield, X, ChevronUp, ChevronDown } from './Icons';
import LiveLocationShare from './LiveLocationShare';
import FakeIncomingCall from './FakeIncomingCall';
import PanicAlarm from './PanicAlarm';
import CommunityAlertButton from './CommunityAlertButton';

export default function SafetyToolsPanel({ userLocation, user, onSOSTriggered }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating toggle pill button — left side, above SOS */}
      <div className="fixed bottom-24 left-5 z-20">
        <button
          onClick={() => setOpen(prev => !prev)}
          className="flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-full shadow-xl border-2 border-white transition-all active:scale-95"
          title="Quick Safety Tools"
        >
          <Shield className="w-4 h-4" />
          <span>Safety Tools</span>
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
      </div>

      {/* Slide-in panel from left */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="fixed top-20 left-3 sm:left-4 z-50 w-full max-w-sm bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in slide-in-from-left-4 duration-300 max-h-[80vh] flex flex-col">

            {/* Header Bar */}
            <div className="p-4 bg-[#0B0F2E] text-white flex justify-between items-center">
              <div className="flex items-center gap-2 font-extrabold text-xs uppercase tracking-wider">
                <Shield className="w-4 h-4 text-indigo-400" />
                <span>Emergency Safety Tools</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">

              {/* Top Warning Banner */}
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl">
                <p className="text-xs text-rose-900 font-bold leading-relaxed">
                  🚨 <strong>Emergency Tools:</strong> Use these features when you feel unsafe or need immediate help.
                </p>
              </div>

              {/* Tool 1: Share Location */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
                <div className="mb-3">
                  <h3 className="text-sm font-extrabold text-slate-900 mb-1">Share Live Location</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Get your current GPS coordinates and share them via WhatsApp, SMS, or copy the link to clipboard.
                  </p>
                </div>
                <LiveLocationShare />
              </div>

              {/* Tool 3: Fake Call */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
                <div className="mb-3">
                  <h3 className="text-sm font-extrabold text-slate-900 mb-1">Fake Incoming Call</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Trigger a realistic fake phone call in 10 seconds to escape uncomfortable situations discreetly.
                  </p>
                </div>
                <FakeIncomingCall />
              </div>

              {/* Tool 4: Panic Alarm */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
                <div className="mb-3">
                  <h3 className="text-sm font-extrabold text-slate-900 mb-1">Panic Alarm</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Activate a loud siren and flashing strobe effect to draw attention in emergencies.
                  </p>
                </div>
                <PanicAlarm />
              </div>

              {/* Tool 5: Community Alert */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
                <div className="mb-3">
                  <h3 className="text-sm font-extrabold text-slate-900 mb-1">Alert Nearby Users</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Feeling unsafe? Broadcast an anonymous alert to all Nirbhay users within 1km so they stay aware.
                  </p>
                </div>
                <CommunityAlertButton userLocation={userLocation} />
              </div>

            </div>

          </div>
        </>
      )}
    </>
  );
}
