import React, { useState } from 'react';
import { AlertTriangle, Shield, CheckCircle, Phone, X, Radio } from './Icons';

export default function SosButton({ userLocation, user, onPromptEmergencyContact }) {
  const [activeState, setActiveState] = useState('idle'); // 'idle' | 'alerting' | 'confirmed'
  const [sosDetails, setSosDetails] = useState(null);
  const [error, setError] = useState(null);

  const handleTriggerSos = async () => {
    // 1. Check emergency contact saved
    const savedContact = user ? user.emergency_contact : null;
    if (!savedContact) {
      onPromptEmergencyContact();
      return;
    }

    setActiveState('alerting');
    setError(null);

    try {
      const payload = {
        userId: user ? user.id : 'anon_user',
        lat: userLocation.lat || 28.6328,
        lng: userLocation.lng || 77.2195
      };

      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch SOS alert');
      }

      setSosDetails(data);
      setActiveState('confirmed');
    } catch (err) {
      console.error('SOS dispatch error:', err);
      setError('Failed to send SOS alert. Please retry!');
      setActiveState('idle');
    }
  };

  return (
    <>
      {/* Persistent SOS Floating Button (Bottom Left corner) */}
      <div className="fixed bottom-8 left-5 z-20">
        <button
          onClick={handleTriggerSos}
          disabled={activeState === 'alerting'}
          className="flex items-center gap-2 px-5 py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider rounded-full shadow-[0_0_20px_rgba(225,29,72,0.6)] border-2 border-white transition-all disabled:opacity-50"
          title="Trigger Emergency SOS Alert to Guardian Contact"
        >
          <Radio className="w-4 h-4 text-white animate-pulse" />
          <span>SOS Emergency</span>
        </button>
      </div>

      {/* Alerting / Confirmation Overlay Modal */}
      {activeState !== 'idle' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center border border-slate-100">
            
            {activeState === 'alerting' ? (
              <div className="py-6 space-y-4">
                <div className="relative inline-flex items-center justify-center">
                  <div className="w-20 h-20 bg-rose-100 rounded-full animate-ping absolute" />
                  <div className="w-16 h-16 bg-rose-600 text-white rounded-full flex items-center justify-center relative shadow-lg">
                    <Radio className="w-8 h-8 animate-pulse" />
                  </div>
                </div>

                <h3 className="text-xl font-extrabold text-slate-900">Alerting Emergency Contacts...</h3>
                <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto">
                  Capturing live location telemetry & evaluating spatial risk factors...
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center">
                  <CheckCircle className="w-8 h-8" />
                </div>

                <h3 className="text-xl font-extrabold text-slate-900">SOS Emergency Dispatched!</h3>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-left space-y-2">
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-indigo-600" />
                    <span>SMS Sent to Emergency Contact</span>
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-mono bg-white p-2 rounded-xl border border-slate-100">
                    "{sosDetails?.messageBody}"
                  </p>
                </div>

                {/* Simulated Police Alert Banner */}
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-center gap-2 text-left">
                  <Shield className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-amber-900">Police Telemetry Alerted</p>
                    <p className="text-[11px] text-amber-700">{sosDetails?.simulatedPoliceAlert}</p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveState('idle')}
                  className="w-full py-3 bg-[#0B0F2E] hover:bg-indigo-950 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                >
                  Dismiss Confirmation
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
