import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Radio, CheckCircle, ChevronRight, X, Compass, MapPin } from './Icons';

export default function RecentAlertsFeed({ isOpen, onClose, onSelectAlert, refreshTrigger }) {
  const [alerts, setAlerts] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFeedData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/alerts').then(res => res.json()),
      fetch('/api/anomalies').then(res => res.json())
    ])
      .then(([alertsData, anomaliesData]) => {
        if (alertsData.success) setAlerts(alertsData.alerts);
        if (anomaliesData.success) setAnomalies(anomaliesData.anomalies);
      })
      .catch(err => console.warn('Fetch feed error:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFeedData();
  }, [refreshTrigger]);

  if (!isOpen) return null;

  return (
    <div className="absolute top-20 right-3 sm:right-4 z-40 w-full max-w-sm bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in slide-in-from-right-4 duration-300 max-h-[80vh] flex flex-col">
      
      {/* Header Bar */}
      <div className="p-4 bg-[#0B0F2E] text-white flex justify-between items-center">
        <div className="flex items-center gap-2 font-extrabold text-xs uppercase tracking-wider">
          <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
          <span>Recent Safety Telemetry</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
        >
          <X className="w-4.5 h-4.5" />
        </button>
      </div>

      <div className="p-3.5 overflow-y-auto space-y-3 flex-1">
        
        {/* Feature 3: Anomaly Detection Top Alert Banner */}
        {anomalies && anomalies.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest px-1">
              🚨 Active Anomaly Spikes
            </p>
            {anomalies.map(anom => (
              <div
                key={anom.cellId}
                onClick={() => onSelectAlert({ lat: anom.lat, lng: anom.lng, zone_id: anom.cellId })}
                className="p-3.5 bg-gradient-to-r from-rose-900 to-slate-900 text-white rounded-2xl shadow-md border border-rose-600/40 cursor-pointer hover:border-rose-400 transition-all"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-rose-500 text-white rounded-full animate-pulse">
                    UNUSUAL ACTIVITY SPIKE
                  </span>
                  <span className="text-[10px] font-bold text-rose-200">{anom.reportsIn2h || anom.reportCount || 2} reports / 2h</span>
                </div>
                <p className="text-xs font-bold text-white mb-1">{anom.locationName}</p>
                <p className="text-[11px] text-rose-100 font-medium leading-relaxed">
                  ✨ {anom.aiSummary}
                </p>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-1 pt-1">
          Live Community Feed ({alerts.length})
        </p>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500 font-semibold">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>Fetching live telemetry feed...</span>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 font-medium">
            No recent reports logged in the feed.
          </div>
        ) : (
          <div className="space-y-2.5">
            {alerts.map(a => (
              <div
                key={a.id}
                onClick={() => onSelectAlert(a)}
                className="p-3 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-2xl transition-all cursor-pointer flex items-start justify-between gap-2 group"
              >
                <div className="space-y-1">
                  
                  {/* Badges Row */}
                  <div className="flex items-center gap-2">
                    {/* Status Badge */}
                    {a.statusBadge === 'LIVE' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                        LIVE
                      </span>
                    ) : a.statusBadge === 'Verified' ? (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Verified
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                        Pending
                      </span>
                    )}

                    {/* Severity Badge */}
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      a.severity === 'high' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'
                    }`}>
                      {a.severity}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h4 className="text-xs font-bold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors">
                    {a.description}
                  </h4>

                  {/* Location & Time-ago */}
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-indigo-500" />
                      {a.locationName}
                    </span>
                    <span>•</span>
                    <span>{a.timeAgoText}</span>
                  </div>

                </div>

                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all mt-1" />
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
