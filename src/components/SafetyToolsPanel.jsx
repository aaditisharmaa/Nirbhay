import React, { useState } from 'react';
import {
  Shield, X, ChevronUp, ChevronDown,
  Phone, PhoneCall, Mic, MapPin, PhoneIncoming,
  Siren, Radio, AlertTriangle
} from './Icons';
import LiveLocationShare from './LiveLocationShare';
import FakeIncomingCall from './FakeIncomingCall';
import PanicAlarm from './PanicAlarm';
import CommunityAlertButton from './CommunityAlertButton';
import GuardianMode from './GuardianMode';

export default function SafetyToolsPanel({ userLocation, user, onSOSTriggered, onThreatDetected }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating toggle pill */}
      <div className="fixed bottom-20 left-5 z-20">
        <button
          onClick={() => setOpen(prev => !prev)}
          className="flex items-center gap-2 px-4 py-2.5 font-extrabold text-xs uppercase tracking-wider rounded-full transition-all active:scale-95 text-white"
          style={{
            background: 'rgba(11,15,46,0.88)',
            border: '1px solid rgba(99,102,241,0.5)',
            boxShadow: '0 0 14px rgba(99,102,241,0.35)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <Shield className="w-4 h-4 text-indigo-300" />
          <span>Safety Tools</span>
          {open ? <ChevronDown className="w-3 h-3 text-indigo-300" /> : <ChevronUp className="w-3 h-3 text-indigo-300" />}
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setOpen(false)} />

          <div className="fixed top-20 left-3 sm:left-4 z-50 w-full max-w-sm bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in slide-in-from-left-4 duration-300 max-h-[80vh] flex flex-col">

            {/* Header */}
            <div className="p-4 bg-[#0B0F2E] text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2 font-extrabold text-xs uppercase tracking-wider">
                <Shield className="w-4 h-4 text-indigo-400" />
                Emergency Safety Tools
              </div>
              <button onClick={() => setOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">

              {/* Warning banner — no emoji */}
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-rose-900 font-bold leading-relaxed">
                  <strong>Emergency Tools:</strong> Use these features when you feel unsafe or need immediate help.
                </p>
              </div>

              {/* Call Police / Helpline */}
              <div className="p-4 rounded-2xl" style={{background:'rgba(11,15,46,0.05)',border:'1px solid rgba(99,102,241,0.2)'}}>
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="w-4 h-4 text-slate-700" />
                  <h3 className="text-sm font-extrabold text-slate-900">Call Police / Helpline</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  Tap to open your phone's dialer. You confirm the call — nothing is dialled automatically.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <a href="tel:112"
                    className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-2xl font-extrabold text-white text-xs text-center active:scale-95 transition-all"
                    style={{background:'rgba(185,28,28,0.9)',border:'1px solid rgba(252,165,165,0.3)'}}>
                    <PhoneCall className="w-5 h-5" />
                    <span className="text-base font-black leading-none">112</span>
                    <span className="font-semibold text-red-200 text-[10px] uppercase tracking-wide">Police</span>
                  </a>
                  <a href="tel:1091"
                    className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-2xl font-extrabold text-white text-xs text-center active:scale-95 transition-all"
                    style={{background:'rgba(109,40,217,0.9)',border:'1px solid rgba(196,181,253,0.3)'}}>
                    <PhoneCall className="w-5 h-5" />
                    <span className="text-base font-black leading-none">1091</span>
                    <span className="font-semibold text-violet-200 text-[10px] uppercase tracking-wide">Women Helpline</span>
                  </a>
                </div>
              </div>

              {/* Guardian Mode */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <div className="flex items-center gap-2 mb-1">
                  <Mic className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-sm font-extrabold text-slate-900">Guardian Mode</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Listens via your microphone for screams, crashes and distress keywords. Auto-triggers an alert when a threat is detected.
                </p>
                <GuardianMode onThreatDetected={onThreatDetected} />
              </div>

              {/* Share Live Location */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-slate-700" />
                  <h3 className="text-sm font-extrabold text-slate-900">Share Live Location</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Get your current GPS coordinates and share them via WhatsApp, SMS, or copy the link to clipboard.
                </p>
                <LiveLocationShare />
              </div>

              {/* Fake Incoming Call */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="flex items-center gap-2 mb-1">
                  <PhoneIncoming className="w-4 h-4 text-slate-700" />
                  <h3 className="text-sm font-extrabold text-slate-900">Fake Incoming Call</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Trigger a realistic fake phone call in 10 seconds to escape uncomfortable situations discreetly.
                </p>
                <FakeIncomingCall />
              </div>

              {/* Panic Alarm */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-slate-700" />
                  <h3 className="text-sm font-extrabold text-slate-900">Panic Alarm</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Activate a loud siren and flashing strobe effect to draw attention in emergencies.
                </p>
                <PanicAlarm />
              </div>

              {/* Alert Nearby Users */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="flex items-center gap-2 mb-1">
                  <Radio className="w-4 h-4 text-slate-700" />
                  <h3 className="text-sm font-extrabold text-slate-900">Alert Nearby Users</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Feeling unsafe? Broadcast an alert to all Nirbhay users within 1km so they stay aware.
                </p>
                <CommunityAlertButton userLocation={userLocation} />
              </div>

            </div>
          </div>
        </>
      )}
    </>
  );
}
