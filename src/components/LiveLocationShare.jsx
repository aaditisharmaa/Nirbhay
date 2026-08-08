import React, { useState } from 'react';
import { MapPin, CheckCircle, AlertTriangle, Copy } from './Icons';

export default function LiveLocationShare({ userLocation }) {
  const [status, setStatus]   = useState('idle'); // idle | locating | done | error
  const [link, setLink]       = useState('');
  const [copyLabel, setCopyLabel] = useState('Copy Link');
  const [errorMsg, setErrorMsg]   = useState('');

  const buildLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

  const shareLink = async (lat, lng) => {
    const url  = buildLink(lat, lng);
    const text = `I need help! My live location: ${url}`;
    setLink(url);

    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Live Location', text, url });
        setStatus('done');
        return;
      } catch (err) {
        if (err.name === 'AbortError') { setStatus('done'); return; }
        // Web Share failed — fall through to clipboard
      }
    }
    // Desktop / no Web Share API — copy to clipboard
    try {
      await navigator.clipboard.writeText(text);
      setStatus('done');
    } catch {
      // clipboard also blocked — just show the link so user can copy manually
      setStatus('done');
    }
  };

  const getAndShare = () => {
    // If browser geolocation isn't available at all, use last-known map location
    if (!navigator.geolocation) {
      if (userLocation?.lat && userLocation?.lng) {
        shareLink(userLocation.lat, userLocation.lng);
      } else {
        setErrorMsg('Geolocation is not supported by your browser.');
        setStatus('error');
      }
      return;
    }

    setStatus('locating');
    setErrorMsg('');

    navigator.geolocation.getCurrentPosition(
      (pos) => shareLink(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        // Geolocation failed — fall back to last known map location if available
        if (userLocation?.lat && userLocation?.lng) {
          shareLink(userLocation.lat, userLocation.lng);
          return;
        }
        const msg = err.code === 1
          ? 'Location permission denied. Allow location access in your browser settings and try again.'
          : 'Could not get precise location. Make sure location is enabled in your browser.';
        setErrorMsg(msg);
        setStatus('error');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  const copyManually = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(`I need help! My live location: ${link}`);
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy Link'), 2000);
    } catch { setCopyLabel('Copy failed'); }
  };

  const reset = () => { setStatus('idle'); setLink(''); setErrorMsg(''); setCopyLabel('Copy Link'); };

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Main action button */}
      <button
        onClick={status === 'done' || status === 'error' ? reset : getAndShare}
        disabled={status === 'locating'}
        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-60
          ${status === 'done'  ? 'bg-emerald-600 text-white'
          : status === 'error' ? 'bg-amber-500 text-white'
          : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
      >
        {status === 'locating'
          ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Getting location…</>
          : status === 'done'
          ? <><CheckCircle className="w-4 h-4" />Location ready — tap to reset</>
          : status === 'error'
          ? <><AlertTriangle className="w-4 h-4" />Tap to retry</>
          : <><MapPin className="w-4 h-4" />Share My Location</>
        }
      </button>

      {/* On desktop: show the link so user can copy/paste manually */}
      {status === 'done' && link && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center gap-2">
          <span className="text-[10px] text-slate-600 flex-1 truncate font-mono">{link}</span>
          <button
            onClick={copyManually}
            className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg transition-all active:scale-95"
          >
            <Copy className="w-3 h-3" />{copyLabel}
          </button>
        </div>
      )}

      {status === 'done' && (
        <p className="text-[11px] text-slate-500 text-center">
          {navigator.share ? 'Shared via your device.' : 'Link copied — paste it in WhatsApp or SMS.'}
        </p>
      )}

      {status === 'error' && (
        <p className="text-[11px] text-rose-600 text-center leading-relaxed">{errorMsg}</p>
      )}
    </div>
  );
}
