import React, { useState } from 'react';
import { Search, Navigation, Shield, Clock, AlertTriangle, X } from './Icons';

export default function RoutePanel({ userLocation, onRouteCalculated, onClose }) {
  const [startQuery, setStartQuery] = useState('Current Location');
  const [destQuery, setDestQuery] = useState('Hauz Khas Village');
  const [travelMode, setTravelMode] = useState('walking'); // 'walking' | 'vehicle'
  const [loading, setLoading] = useState(false);
  const [routeResult, setRouteResult] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [error, setError] = useState(null);

  const handleSearchRoutes = async (e, modeOverride) => {
    if (e) e.preventDefault();
    const activeMode = modeOverride || travelMode;
    setLoading(true);
    setError(null);

    try {
      let startCoords = { lat: userLocation.lat || 28.6328, lng: userLocation.lng || 77.2195 };
      let destCoords = { lat: 28.5528, lng: 77.2038 }; // Hauz Khas Village

      if (startQuery && startQuery !== 'Current Location') {
        const startRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(startQuery + ', Delhi')}`);
        const startData = await startRes.json();
        if (!startData?.length) throw new Error('Start location not found.');
        startCoords = { lat: parseFloat(startData[0].lat), lng: parseFloat(startData[0].lon) };
      }

      if (destQuery && destQuery !== 'Hauz Khas Village') {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destQuery + ', Delhi')}`);
        const geoData = await geoRes.json();
        if (!geoData?.length) throw new Error('Destination not found.');
        destCoords = { lat: parseFloat(geoData[0].lat), lng: parseFloat(geoData[0].lon) };
      }

      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: startCoords, destination: destCoords, travelMode: activeMode })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'No route found between these locations');
      }

      setRouteResult(data);
      setSelectedRouteId(data.safeRouteId);
      onRouteCalculated(data, data.safeRouteId);
    } catch (err) {
      console.error('Route calculation error:', err);
      setError(err.message || 'Failed to fetch route options.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute top-20 left-3 right-3 sm:left-4 sm:max-w-md z-30 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-5 border border-slate-200/80 animate-in fade-in zoom-in duration-200">
      
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-sm">
          <Navigation className="w-5 h-5" />
          <span>Safe Route Navigator</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Item 3: Travel Mode Toggle Switch */}
      <div className="flex bg-slate-100 p-1 rounded-2xl mb-3 border border-slate-200">
        <button
          type="button"
          onClick={() => {
            setTravelMode('walking');
            if (routeResult) handleSearchRoutes(null, 'walking');
          }}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            travelMode === 'walking'
              ? 'bg-[#0B0F2E] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🚶 Walking</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTravelMode('vehicle');
            if (routeResult) handleSearchRoutes(null, 'vehicle');
          }}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            travelMode === 'vehicle'
              ? 'bg-[#0B0F2E] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🚗 Vehicle (2W/4W)</span>
        </button>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSearchRoutes} className="space-y-2.5 mb-4">
        <div className="relative">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={startQuery}
            onChange={(e) => setStartQuery(e.target.value)}
            placeholder="Start point..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={destQuery}
            onChange={(e) => setDestQuery(e.target.value)}
            placeholder="Enter destination (e.g. Lajpat Nagar, Connaught Place)..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-[#0B0F2E] hover:bg-indigo-950 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>Calculate Safe {travelMode === 'vehicle' ? 'Vehicle' : 'Walking'} Routes</span>
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl mb-3">
          {error}
        </div>
      )}

      {/* AI Route Comparison Summary */}
      {routeResult && routeResult.aiSummary && (
        <div className="mb-3 bg-indigo-50 border border-indigo-100 p-3 rounded-2xl">
          <p className="text-xs text-indigo-900 font-semibold leading-relaxed">
            ✨ {routeResult.aiSummary}
          </p>
        </div>
      )}

      {/* Route Cards */}
      {routeResult && routeResult.routes && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {routeResult.routes.map((r) => {
            const isSelected = r.id === selectedRouteId;
            return (
              <div
                key={r.id}
                onClick={() => {
                  setSelectedRouteId(r.id);
                  onRouteCalculated(routeResult, r.id);
                }}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-indigo-900 text-white border-indigo-700 shadow-lg'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-extrabold">{r.name}</span>
                    {r.badge && (
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        isSelected 
                          ? (r.badge === 'Safe Route' ? 'bg-emerald-400 text-slate-950' : 'bg-amber-400 text-slate-950')
                          : (r.badge === 'Safe Route' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')
                      }`}>
                        {r.badge}
                      </span>
                    )}
                  </div>

                  <div className={`flex items-center gap-3 text-xs ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                    <span className="flex items-center gap-1 font-bold">
                      <Clock className="w-3.5 h-3.5" />
                      {r.durationMins} min
                    </span>
                    <span>•</span>
                    <span>{(r.distanceMeters / 1000).toFixed(1)} km</span>
                    {r.speedContext && (
                      <>
                        <span>•</span>
                        <span className="text-[10px]">{r.speedContext}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-xs font-black px-2 py-1 rounded-lg ${
                    r.avgPathRisk > 50 
                      ? (isSelected ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-800')
                      : (isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-emerald-100 text-emerald-800')
                  }`}>
                    {r.avgPathRisk > 50 ? 'Passes Risk Zone' : 'Safe Path'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
