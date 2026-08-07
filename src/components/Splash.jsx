import React, { useEffect, useState } from 'react';
import { GuardianShieldIcon } from './Icons';

export default function Splash({ onFinish, onLocationReady, onDataLoaded }) {
  const [progress, setProgress] = useState(15);
  const [statusText, setStatusText] = useState('Initializing guardian network...');

  useEffect(() => {
    let isMounted = true;

    // High accuracy geolocation API request options
    const geoOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

    // 1. Precise Geolocation Request
    let geoWatchId = null;
    if ('geolocation' in navigator) {
      setStatusText('Acquiring high-precision location telemetry...');
      geoWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (!isMounted) return;
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          onLocationReady(loc);
          if (progress < 60) setProgress(60);
        },
        (err) => {
          console.warn('Location permission denied or timeout (using Delhi center fallback):', err.message);
          if (!isMounted) return;
          onLocationReady({ lat: 28.6328, lng: 77.2195, denied: true });
        },
        geoOptions
      );
    } else {
      onLocationReady({ lat: 28.6328, lng: 77.2195, denied: true });
    }

    // 2. Preload Risk-Zone Dataset in Background
    setStatusText('Preloading spatial risk heatmaps...');
    fetch('/api/zones')
      .then(res => res.json())
      .then(data => {
        if (isMounted) {
          if (data.success) {
            onDataLoaded(data);
          }
          setProgress(90);
        }
      })
      .catch(err => console.warn('Preload data warn:', err));

    // Progress animation timeline
    const timer1 = setTimeout(() => setProgress(45), 600);
    const timer2 = setTimeout(() => setProgress(80), 1400);
    const timer3 = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        if (isMounted) onFinish();
      }, 500);
    }, 2400);

    return () => {
      isMounted = false;
      if (geoWatchId !== null) navigator.geolocation.clearWatch(geoWatchId);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#0B0F2E] text-white overflow-hidden select-none">
      
      {/* 1. Full-Screen Background Image (Plain Eyes Artwork - NO nested boxes) */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-95 transition-transform duration-1000 scale-105"
        style={{ backgroundImage: `url('/splash-bg.jpg')` }}
      />

      {/* 2. Dark Vignette & Gradient Overlay for Maximum Legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B0F2E]/80 via-[#0B0F2E]/25 to-[#0B0F2E]/95 pointer-events-none" />

      {/* 3. Floating Brand Header Overlay (Directly on background, NO container box) */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center pt-16 sm:pt-24 px-4 max-w-3xl mx-auto">
        
        {/* Guardian Shield Emblem Icon floating directly on background */}
        <div className="p-3 bg-indigo-950/60 backdrop-blur-md rounded-2xl border border-indigo-400/30 shadow-[0_0_25px_rgba(139,127,212,0.5)] mb-3 animate-in fade-in zoom-in duration-500">
          <GuardianShieldIcon className="w-10 h-10 sm:w-12 sm:h-12 text-indigo-300" />
        </div>

        {/* Wordmark: Crisp HTML Text "NIRBHAY" in Cinzel Decorative 900 floating directly over eyes background */}
        <h1 
          className="font-black tracking-[0.08em] uppercase select-none leading-none mb-3"
          style={{
            fontFamily: "'Cinzel Decorative', serif",
            fontWeight: 900,
            fontSize: 'clamp(2.8rem, 8.5vw, 5.5rem)',
            background: 'linear-gradient(180deg, #FFFFFF 0%, #E8E6F2 40%, #A598C8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(3px 4px 10px rgba(0,0,0,0.95)) drop-shadow(0 0 25px rgba(165,148,249,0.5))'
          }}
        >
          NIRBHAY
        </h1>

        {/* ONE Single Tagline: Crisp Sans-Serif Text in Muted Lavender */}
        <p 
          className="font-sans font-extrabold tracking-[0.18em] uppercase text-center max-w-lg leading-relaxed"
          style={{
            fontSize: 'clamp(0.68rem, 2vw, 1.05rem)',
            color: '#A594F9',
            textShadow: '0 2px 10px rgba(0,0,0,0.95)'
          }}
        >
          DANGER CAN BE ANYWHERE. BE YOUR OWN GUARDIAN ANGEL.
        </p>

      </div>

      {/* 4. Bottom Loading Telemetry Progress Bar */}
      <div className="relative z-10 w-full max-w-sm px-6 pb-12 text-center">
        {/* Status Subtitle */}
        <p className="text-[11px] uppercase tracking-widest text-indigo-200 font-semibold mb-2.5">
          {statusText}
        </p>

        {/* Progress Bar Container */}
        <div className="w-full bg-slate-950/80 backdrop-blur-md h-2 rounded-full overflow-hidden border border-indigo-500/30 p-[1px] shadow-2xl">
          <div 
            className="bg-gradient-to-r from-indigo-500 via-purple-400 to-indigo-300 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(139,127,212,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Confidentiality Shield Note */}
        <p className="text-[10px] text-slate-300/80 mt-4 tracking-wider uppercase font-medium">
          🔒 End-to-End Private & Anonymous Community Shield
        </p>
      </div>

    </div>
  );
}
