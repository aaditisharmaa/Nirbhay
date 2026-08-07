import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Shield, X, AlertTriangle, CheckCircle } from './Icons';

// --- Threat detection config ---
// Amplitude: 0–255 scale from AnalyserNode. A scream/crash peaks well above normal speech (~80).
const AMPLITUDE_THRESHOLD = 160;   // raw 0-255 value
const SPIKE_SUSTAIN_MS    = 300;    // must stay loud for this long to count (filters out mic pops)
const COOLDOWN_MS         = 8000;   // min gap between two threat alerts

// Distress keywords (English + Hindi)
const DISTRESS_KEYWORDS = [
  'help', 'stop', 'no', 'leave me', 'let go', 'fire', 'run',
  'bachao', 'chodo', 'chhodo', 'ruko', 'police', 'ambulance',
  'attack', 'rape', 'murder', 'thief', 'chor',
];

// Sound-category labels we treat as threats (mapped from rough frequency patterns)
// Since we're not running YAMNet, we label amplitude spikes by character:
// Very sharp instantaneous spike = glass break / crash
// Sustained high amplitude = scream / shout
const categorizeThreat = (peakAmplitude, sustainMs) => {
  if (peakAmplitude > 220 && sustainMs < 200) return 'Impact / Glass Break';
  if (peakAmplitude > AMPLITUDE_THRESHOLD && sustainMs >= SPIKE_SUSTAIN_MS) return 'Scream / Loud Distress';
  return null;
};

export default function GuardianMode({ onThreatDetected }) {
  const [phase, setPhase] = useState('idle'); // idle | requesting | active | threat | error
  const [errorMsg, setErrorMsg] = useState('');
  const [lastThreat, setLastThreat] = useState(null); // { label, time }
  const [volume, setVolume] = useState(0); // 0–100 for the VU bar
  const [keywordDetected, setKeywordDetected] = useState('');
  const [threatCount, setThreatCount] = useState(0);

  const streamRef        = useRef(null);
  const audioCtxRef      = useRef(null);
  const analyserRef      = useRef(null);
  const rafRef           = useRef(null);
  const spikeStartRef    = useRef(null); // timestamp when loud spike began
  const lastAlertRef     = useRef(0);    // timestamp of last threat alert
  const recognitionRef   = useRef(null);
  const activeRef        = useRef(false); // mirrors phase === 'active' for use inside callbacks

  // --- Keyword detection via Web Speech API ---
  const startSpeechRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return; // silently skip on unsupported browsers

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // covers Hindi words too

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase();
        const hit = DISTRESS_KEYWORDS.find(kw => transcript.includes(kw));
        if (hit) {
          setKeywordDetected(hit);
          triggerThreat(`Keyword: "${hit}"`);
          setTimeout(() => setKeywordDetected(''), 4000);
        }
      }
    };

    recognition.onerror = () => {}; // suppress — not critical
    recognition.onend = () => {
      // Restart if guardian mode still active
      if (activeRef.current) {
        try { recognition.start(); } catch (_) {}
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (_) {}
  }, []);

  // --- Amplitude analysis loop ---
  const analyseLoop = useCallback(() => {
    if (!analyserRef.current || !activeRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(dataArray);

    // Peak amplitude: max deviation from 128 (silence centre), scaled to 0–255
    let peak = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const dev = Math.abs(dataArray[i] - 128) * 2;
      if (dev > peak) peak = dev;
    }

    setVolume(Math.round((peak / 255) * 100));

    const now = Date.now();

    if (peak >= AMPLITUDE_THRESHOLD) {
      if (!spikeStartRef.current) spikeStartRef.current = now;
      const sustainMs = now - spikeStartRef.current;
      const label = categorizeThreat(peak, sustainMs);
      if (label && now - lastAlertRef.current > COOLDOWN_MS) {
        triggerThreat(label);
      }
    } else {
      spikeStartRef.current = null;
    }

    rafRef.current = requestAnimationFrame(analyseLoop);
  }, []);

  const triggerThreat = useCallback((label) => {
    const now = Date.now();
    if (now - lastAlertRef.current < COOLDOWN_MS) return;
    lastAlertRef.current = now;

    const threat = { label, time: new Date().toLocaleTimeString() };
    setLastThreat(threat);
    setThreatCount(c => c + 1);
    setPhase('threat');
    onThreatDetected && onThreatDetected(label);

    // Return to active after showing threat for 5s
    setTimeout(() => {
      if (activeRef.current) setPhase('active');
    }, 5000);
  }, [onThreatDetected]);

  const startGuardian = async () => {
    setPhase('requesting');
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyserRef.current = analyser;

      activeRef.current = true;
      setPhase('active');
      setThreatCount(0);
      setLastThreat(null);

      rafRef.current = requestAnimationFrame(analyseLoop);
      startSpeechRecognition();
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Microphone permission denied. Allow mic access and try again.'
        : 'Could not access microphone. Please try again.';
      setErrorMsg(msg);
      setPhase('error');
    }
  };

  const stopGuardian = useCallback(() => {
    activeRef.current = false;
    setPhase('idle');
    setVolume(0);

    cancelAnimationFrame(rafRef.current);

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      recognitionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch (_) {}
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    spikeStartRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopGuardian(), [stopGuardian]);

  // ── UI ──

  if (phase === 'idle' || phase === 'error') {
    return (
      <div className="flex flex-col gap-2">
        {phase === 'error' && (
          <p className="text-[11px] text-rose-600 font-semibold bg-rose-50 px-3 py-2 rounded-xl">{errorMsg}</p>
        )}
        <button
          onClick={startGuardian}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-2xl shadow-md active:scale-95 transition-all"
        >
          <Shield className="w-4 h-4" />
          Activate Guardian Mode
        </button>
        <p className="text-[10px] text-slate-400 text-center leading-relaxed">
          Listens for screams, crashes & distress keywords. Requires mic permission.
        </p>
      </div>
    );
  }

  if (phase === 'requesting') {
    return (
      <div className="w-full py-3 flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl">
        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-bold text-emerald-700">Requesting microphone…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">

      {/* Status header */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-2xl border
        ${phase === 'threat'
          ? 'bg-rose-50 border-rose-300'
          : 'bg-emerald-50 border-emerald-200'
        }`}
      >
        <div className="flex items-center gap-2">
          {phase === 'threat'
            ? <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce" />
            : <Shield className="w-4 h-4 text-emerald-600 animate-pulse" />
          }
          <span className={`text-xs font-extrabold ${phase === 'threat' ? 'text-rose-700' : 'text-emerald-700'}`}>
            {phase === 'threat' ? '⚠ Threat Detected!' : 'Guardian Mode Active'}
          </span>
        </div>
        <button
          onClick={stopGuardian}
          className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Live VU meter */}
      <div>
        <div className="flex justify-between text-[10px] text-slate-400 font-semibold mb-1">
          <span>Ambient sound level</span>
          <span>{volume}%</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-75
              ${volume > 70 ? 'bg-rose-500' : volume > 40 ? 'bg-amber-400' : 'bg-emerald-500'}`}
            style={{ width: `${volume}%` }}
          />
        </div>
        {volume > 70 && (
          <p className="text-[10px] text-rose-500 font-semibold mt-0.5 animate-pulse">
            High noise detected…
          </p>
        )}
      </div>

      {/* Last threat */}
      {lastThreat && (
        <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl">
          <p className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider mb-0.5">
            Last threat — {lastThreat.time}
          </p>
          <p className="text-xs font-bold text-rose-900">{lastThreat.label}</p>
          <p className="text-[10px] text-rose-600 mt-0.5">
            Alerts triggered: {threatCount}
          </p>
        </div>
      )}

      {/* Keyword hit */}
      {keywordDetected && (
        <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl animate-pulse">
          <p className="text-xs font-extrabold text-amber-800">
            🎙 Keyword heard: <span className="uppercase">"{keywordDetected}"</span>
          </p>
        </div>
      )}

      {/* Listening indicators */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          Amplitude monitor
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
          {(window.SpeechRecognition || window.webkitSpeechRecognition)
            ? 'Keyword detector'
            : 'Keyword (unsupported)'}
        </span>
      </div>

      <button
        onClick={stopGuardian}
        className="w-full py-2 text-xs font-bold text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-xl transition-all"
      >
        Stop Guardian Mode
      </button>
    </div>
  );
}
