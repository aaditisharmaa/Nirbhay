import React, { useState, useRef } from 'react';
import { Search, Navigation, Shield, Clock, X } from './Icons';
import { useNominatimAutocomplete } from '../utils/useNominatimAutocomplete';

// Shared autocomplete input — renders the text field + dropdown suggestion list
function AutocompleteInput({ value, onChange, onSelect, placeholder, icon, userLocation, inputClass }) {
  const { suggestions, loading, search, clear } = useNominatimAutocomplete(userLocation);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const handleChange = (e) => {
    onChange(e.target.value);
    search(e.target.value);
    setOpen(true);
  };

  const handleSelect = (s) => {
    onChange(s.shortLabel);
    onSelect(s);
    clear();
    setOpen(false);
  };

  const handleBlur = () => {
    // Delay close so click on suggestion fires first
    setTimeout(() => setOpen(false), 150);
  };

  const showDropdown = open && (loading || suggestions.length > 0);

  return (
    <div ref={wrapRef} className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">{icon}</span>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => value.length >= 3 && setOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${inputClass}`}
        autoComplete="off"
      />
      {showDropdown && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-xl overflow-hidden shadow-xl"
          style={{background:'rgba(11,15,46,0.97)',border:'1px solid rgba(99,102,241,0.4)'}}>
          {loading && (
            <div className="px-3 py-2 text-[11px] text-indigo-300 flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"/>
              Searching…
            </div>
          )}
          {!loading && suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => handleSelect(s)}
              className="w-full text-left px-3 py-2 text-[11px] text-slate-200 hover:bg-indigo-800/60 transition-colors border-b border-white/5 last:border-0"
            >
              <span className="font-semibold text-white block truncate">{s.shortLabel}</span>
              <span className="text-slate-400 text-[10px] truncate block">{s.label}</span>
            </button>
          ))}
          {!loading && suggestions.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-slate-400">No results found.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RoutePanel({ userLocation, onRouteCalculated, onClose }) {
  const [startQuery, setStartQuery]   = useState('Current Location');
  const [destQuery, setDestQuery]     = useState('');
  const [startCoords, setStartCoords] = useState(null); // null = use GPS
  const [destCoords, setDestCoords]   = useState(null);
  const [travelMode, setTravelMode]   = useState('walking');
  const [loading, setLoading]         = useState(false);
  const [routeResult, setRouteResult] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [error, setError]             = useState(null);

  const handleSearchRoutes = async (e, modeOverride) => {
    if (e) e.preventDefault();
    const activeMode = modeOverride || travelMode;
    setLoading(true);
    setError(null);

    try {
      // Start — use pre-selected coords if available, else GPS, else geocode query
      let origin = startCoords
        ?? { lat: userLocation?.lat || 28.6328, lng: userLocation?.lng || 77.2195 };

      if (!startCoords && startQuery && startQuery !== 'Current Location') {
        const res  = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(startQuery)}&countrycodes=in&limit=1`);
        const data = await res.json();
        if (!Array.isArray(data) || !data.length) throw new Error('Start location not found.');
        origin = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }

      // Destination — use pre-selected coords if available, else geocode
      let destination = destCoords ?? null;
      if (!destination) {
        if (!destQuery.trim()) throw new Error('Please enter a destination.');
        const res  = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destQuery)}&countrycodes=in&limit=1`);
        const data = await res.json();
        if (!Array.isArray(data) || !data.length) throw new Error('Destination not found.');
        destination = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }

      const res  = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination, travelMode: activeMode })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'No route found.');

      setRouteResult(data);
      setSelectedRouteId(data.safeRouteId);
      onRouteCalculated(data, data.safeRouteId);
    } catch (err) {
      setError(err.message || 'Failed to fetch route options.');
    } finally {
      setLoading(false);
    }
  };

  const dotIcon = <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />;
  const searchIcon = <Search className="w-4 h-4 text-slate-400" />;
  const inputCls = 'bg-slate-50 border border-slate-200 text-slate-900';

  return (
    <div className="absolute top-20 left-3 right-3 sm:left-4 sm:max-w-md z-30 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-5 border border-slate-200/80 animate-in fade-in zoom-in duration-200">

      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-sm">
          <Navigation className="w-5 h-5" />
          Safe Route Navigator
        </div>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Travel mode toggle */}
      <div className="flex bg-slate-100 p-1 rounded-2xl mb-3 border border-slate-200">
        {[['walking','🚶 Walking'],['vehicle','🚗 Vehicle']].map(([m, label]) => (
          <button key={m} type="button"
            onClick={() => { setTravelMode(m); if (routeResult) handleSearchRoutes(null, m); }}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${travelMode === m ? 'bg-[#0B0F2E] text-white shadow-md' : 'text-slate-600 hover:text-slate-900'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Inputs with autocomplete */}
      <form onSubmit={handleSearchRoutes} className="space-y-2.5 mb-4">
        <AutocompleteInput
          value={startQuery}
          onChange={(v) => { setStartQuery(v); setStartCoords(null); }}
          onSelect={(s) => { setStartQuery(s.shortLabel); setStartCoords({ lat: s.lat, lng: s.lng }); }}
          placeholder="Start point (or leave for GPS)…"
          icon={dotIcon}
          userLocation={userLocation}
          inputClass={inputCls}
        />
        <AutocompleteInput
          value={destQuery}
          onChange={(v) => { setDestQuery(v); setDestCoords(null); }}
          onSelect={(s) => { setDestQuery(s.shortLabel); setDestCoords({ lat: s.lat, lng: s.lng }); }}
          placeholder="Destination (e.g. Lajpat Nagar)…"
          icon={searchIcon}
          userLocation={userLocation}
          inputClass={inputCls}
        />

        <button type="submit" disabled={loading}
          className="w-full py-2.5 bg-[#0B0F2E] hover:bg-indigo-950 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
          {loading
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><Shield className="w-4 h-4 text-indigo-400" />Calculate Safe {travelMode === 'vehicle' ? 'Vehicle' : 'Walking'} Routes</>
          }
        </button>
      </form>

      {error && <div className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl mb-3">{error}</div>}

      {routeResult?.aiSummary && (
        <div className="mb-3 bg-indigo-50 border border-indigo-100 p-3 rounded-2xl">
          <p className="text-xs text-indigo-900 font-semibold leading-relaxed">✨ {routeResult.aiSummary}</p>
        </div>
      )}

      {routeResult?.routes && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {routeResult.routes.map(r => {
            const isSelected = r.id === selectedRouteId;
            return (
              <div key={r.id} onClick={() => { setSelectedRouteId(r.id); onRouteCalculated(routeResult, r.id); }}
                className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${isSelected ? 'bg-indigo-900 text-white border-indigo-700 shadow-lg' : 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200'}`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-extrabold">{r.name}</span>
                    {r.badge && (
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${isSelected ? (r.badge === 'Safe Route' ? 'bg-emerald-400 text-slate-950' : 'bg-amber-400 text-slate-950') : (r.badge === 'Safe Route' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}`}>
                        {r.badge}
                      </span>
                    )}
                  </div>
                  <div className={`flex items-center gap-3 text-xs ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                    <span className="flex items-center gap-1 font-bold">
                      <Clock className="w-3.5 h-3.5" />{r.durationMins} min
                    </span>
                    <span>•</span><span>{(r.distanceMeters / 1000).toFixed(1)} km</span>
                    {r.speedContext && <><span>•</span><span className="text-[10px]">{r.speedContext}</span></>}
                  </div>
                </div>
                {r.avgPathRisk > 50 && (
                  <span className={`text-xs font-black px-2 py-1 rounded-lg ${isSelected ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-800'}`}>
                    ⚠ Passes Risk Zone
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
