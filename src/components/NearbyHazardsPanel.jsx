import React, { useState, useEffect } from 'react';
import { getDistanceMeters, getCompassDirection } from '../utils/geo';
import { Shield, ChevronRight, X, AlertTriangle, Compass, ChevronDown, ChevronUp } from './Icons';

export default function NearbyHazardsPanel({ userLocation = {}, zones = [], onSelectZone }) {
  const [isOpen, setIsOpen] = useState(true); // Open by default in Explore Mode
  const [aiSummary, setAiSummary] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  const uLat = userLocation.lat || 28.6328;
  const uLng = userLocation.lng || 77.2195;

  // Filter & sort risk zones within 1000m (1km)
  const nearbyZones = zones
    .map(zone => {
      const distMeters = getDistanceMeters(uLat, uLng, zone.lat, zone.lng);
      const direction = getCompassDirection(uLat, uLng, zone.lat, zone.lng);
      return {
        ...zone,
        distMeters,
        direction
      };
    })
    .filter(z => z.distMeters > 20 && z.distMeters <= 1000) // Within 1km
    .sort((a, b) => a.distMeters - b.distMeters);

  // Fetch 1-line AI summary based on nearby aggregate data
  useEffect(() => {
    let isMounted = true;
    if (nearbyZones.length === 0) {
      setAiSummary("You're in a clear area — no hazard zones reported within 1km.");
      return;
    }

    setLoadingAi(true);
    const maxRiskLevel = nearbyZones.some(z => z.riskLevel === 'High') ? 'High' : 'Moderate';
    const topCategory = Object.keys(nearbyZones[0]?.categoryCounts || {})[0] || 'Poor Lighting';

    fetch('/api/nearby-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nearbyCount: nearbyZones.length,
        maxRiskLevel,
        topCategory
      })
    })
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.success) {
          setAiSummary(data.summary);
        }
      })
      .catch(err => console.warn('Nearby AI summary err:', err))
      .finally(() => {
        if (isMounted) setLoadingAi(false);
      });

    return () => { isMounted = false; };
  }, [zones.length, uLat, uLng]);

  return (
    <div className="absolute top-20 left-3 sm:left-4 z-30 w-full max-w-sm bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in fade-in zoom-in duration-200 pointer-events-auto">
      
      {/* Header Bar with Toggle */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-3.5 bg-[#0B0F2E] text-white flex justify-between items-center cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 font-extrabold text-xs uppercase tracking-wider">
          <Compass className="w-4 h-4 text-indigo-400" />
          <span>Nearby Hazards</span>
          <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full">
            {nearbyZones.length} within 1km
          </span>
        </div>
        <button className="p-1 text-slate-400 hover:text-white">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="p-3.5 space-y-3 max-h-72 overflow-y-auto">
          
          {/* Top 1-Line AI Summary Line */}
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl">
            {loadingAi ? (
              <div className="flex items-center gap-2 text-xs text-indigo-700 font-semibold">
                <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span>Evaluating nearby spatial risk...</span>
              </div>
            ) : (
              <p className="text-xs text-indigo-950 font-bold leading-relaxed">
                ✨ {aiSummary}
              </p>
            )}
          </div>

          {/* List of Nearby Zones */}
          {nearbyZones.length === 0 ? (
            <div className="text-center py-4 text-xs font-medium text-slate-500">
              No hazard zones identified within 1km radius.
            </div>
          ) : (
            <div className="space-y-2">
              {nearbyZones.slice(0, 6).map(zone => {
                const topCat = Object.keys(zone.categoryCounts || {})[0] || 'Safety hazard';
                const countText = zone.reportCount > 0 ? `${zone.reportCount} recent report${zone.reportCount > 1 ? 's' : ''}` : 'Public data signal';
                
                return (
                  <div
                    key={zone.cellId}
                    onClick={() => onSelectZone(zone)}
                    className="p-3 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200/80 hover:border-indigo-200 rounded-2xl transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-extrabold text-slate-900">
                          {zone.distMeters}m {zone.direction}
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          (zone.riskLevel || 'Low') === 'High' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {zone.riskLevel || 'Low'}
                        </span>
                      </div>

                      <p className="text-[11px] font-semibold text-slate-600">
                        {topCat} reported, {countText}
                      </p>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
