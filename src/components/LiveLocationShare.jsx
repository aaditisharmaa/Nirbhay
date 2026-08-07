import React, { useState } from 'react';
import { MapPin, CheckCircle } from './Icons';

const STATUS = {
  idle: 'idle',
  locating: 'locating',
  shared: 'shared',
  copied: 'copied',
  error: 'error',
};

export default function LiveLocationShare() {
  const [status, setStatus] = useState(STATUS.idle);
  const [errorMsg, setErrorMsg] = useState('');

  const getAndShare = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      setStatus(STATUS.error);
      return;
    }
    setStatus(STATUS.locating);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        const shareText = `🚨 I need help! My live location: ${mapsUrl}`;

        if (navigator.share) {
          try {
            await navigator.share({ title: 'My Live Location', text: shareText, url: mapsUrl });
            setStatus(STATUS.shared);
          } catch (err) {
            // User cancelled share — fall back to clipboard quietly
            await copyToClipboard(mapsUrl);
          }
        } else {
          await copyToClipboard(mapsUrl);
        }
      },
      (err) => {
        setErrorMsg(err.code === 1 ? 'Location permission denied.' : 'Could not get your location. Try again.');
        setStatus(STATUS.error);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const copyToClipboard = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus(STATUS.copied);
    } catch {
      setErrorMsg('Could not copy link. Please try again.');
      setStatus(STATUS.error);
    }
  };

  const reset = () => { setStatus(STATUS.idle); setErrorMsg(''); };

  const isLoading = status === STATUS.locating;
  const isDone = status === STATUS.shared || status === STATUS.copied;

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={isDone || status === STATUS.error ? reset : getAndShare}
        disabled={isLoading}
        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-sm transition-all shadow-md active:scale-95 disabled:opacity-60
          ${isDone ? 'bg-emerald-500 text-white'
            : status === STATUS.error ? 'bg-amber-500 text-white'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'}
        `}
      >
        {isLoading
          ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Getting location…</>
          : isDone
          ? <><CheckCircle className="w-4 h-4" />{status === STATUS.copied ? 'Link copied!' : 'Shared!'}</>
          : status === STATUS.error
          ? <>⚠ Tap to retry</>
          : <><MapPin className="w-4 h-4" />Share My Location</>
        }
      </button>

      {status === STATUS.error && (
        <p className="text-[11px] text-rose-500 text-center">{errorMsg}</p>
      )}
      {status === STATUS.copied && (
        <p className="text-[11px] text-slate-500 text-center">Location link copied — paste it in WhatsApp or SMS.</p>
      )}
    </div>
  );
}
