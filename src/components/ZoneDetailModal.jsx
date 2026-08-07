import React, { useState, useEffect } from 'react';
import { ThumbsUp, Shield, X, AlertTriangle, Info, Lock, CheckCircle } from './Icons';
import { authenticatedHeaders } from '../utils/api';

export default function ZoneDetailModal({ zone, user, onClose, onReportConfirmed }) {
  const [details, setDetails] = useState(zone);
  const [loadingAi, setLoadingAi] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [confirmError, setConfirmError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoadingAi(true);

    fetch(`/api/zone-explain/${zone.cellId}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.success) {
          setDetails(data.zone);
        }
      })
      .catch(err => console.warn('Fetch zone detail err:', err))
      .finally(() => {
        if (isMounted) setLoadingAi(false);
      });

    return () => { isMounted = false; };
  }, [zone.cellId]);

  const handleConfirmReport = async (reportId) => {
    if (!user) {
      setConfirmError('Please sign in to confirm community reports.');
      return;
    }

    setConfirmingId(reportId);
    setConfirmError(null);

    try {
      const res = await fetch(`/api/reports/${reportId}/confirm`, {
        method: 'POST',
        headers: await authenticatedHeaders()
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to confirm report');

      // Update local report confirm count
      setDetails(prev => ({
        ...prev,
        reports: prev.reports.map(r => r.id === reportId ? { ...r, confirm_count: data.confirmCount } : r)
      }));

      onReportConfirmed();
    } catch (err) {
      setConfirmError(err.message);
    } finally {
      setConfirmingId(null);
    }
  };

  const getRiskBadge = (level) => {
    switch (level) {
      case 'High':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'Moderate':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
  };

  const totalCategoryReports = Object.values(details.categoryCounts || {}).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 border border-slate-100 max-h-[85vh] overflow-y-auto">
        
        {/* Header Bar */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${getRiskBadge(details.riskLevel || 'Low')}`}>
                {details.riskLevel || 'Low'} Risk
              </span>
              <span className="text-xl font-extrabold text-slate-900">
                {details.score}<span className="text-xs text-slate-400 font-medium">/100</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Grid Cell #{details.cellId} ({details.lat.toFixed(4)}, {details.lng.toFixed(4)})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feature 1: AI Model Confidence Percentage with Progress Bar */}
        <div className="mb-4 bg-slate-50 border border-slate-200/80 p-3 rounded-2xl">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>AI Scoring Model Confidence</span>
            </span>
            <span className="text-indigo-600 font-black">{details.confidencePercent || 45}% confidence</span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${details.confidencePercent || 45}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {details.confidenceText || 'Based on available spatial data and community reports'}
          </p>
        </div>

        {/* Feature 3 Anomaly Spike Highlight */}
        {details.isAnomaly && (
          <div className="mb-4 flex items-start gap-2 bg-rose-50 border border-rose-200 p-3 rounded-2xl animate-pulse">
            <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-rose-900">Unusual Activity Spike</p>
              <p className="text-[11px] text-rose-700 font-medium">This zone has received an abnormal spike in reports in the last 2 hours.</p>
            </div>
          </div>
        )}

        {/* Feature 1: AI Score Explainer & 3-4 Contributing Factors */}
        <div className="mb-5 bg-gradient-to-br from-indigo-950 via-[#0B0F2E] to-slate-900 text-white p-4.5 rounded-2xl shadow-lg border border-indigo-900/60">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span>AI Score Explainer</span>
            </div>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-semibold">Claude AI</span>
          </div>

          {loadingAi ? (
            <div className="flex items-center gap-2 text-xs text-indigo-200 py-3">
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <span>Analyzing spatial intelligence & telemetry...</span>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-indigo-100 font-medium">
                {details.explanation}
              </p>

              {/* Bulleted Contributing Factors List */}
              {details.contributing_factors && details.contributing_factors.length > 0 && (
                <div className="pt-2 border-t border-indigo-800/60">
                  <p className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider mb-1.5">
                    Key Contributing Factors:
                  </p>
                  <ul className="space-y-1">
                    {details.contributing_factors.map((factor, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-indigo-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Feature 1: Category Breakdown Bar List */}
        {details.categoryCounts && Object.keys(details.categoryCounts).length > 0 && (
          <div className="mb-5 bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2.5">
              Incident Category Breakdown
            </h4>
            <div className="space-y-2">
              {Object.entries(details.categoryCounts).map(([cat, count]) => {
                const pct = Math.round((count / totalCategoryReports) * 100);
                return (
                  <div key={cat}>
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-800 mb-1">
                      <span>{cat}</span>
                      <span className="text-indigo-600 font-bold">{pct}% ({count})</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {confirmError && (
          <div className="mb-3 text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl">
            {confirmError}
          </div>
        )}

        {/* Community Reports List */}
        <div>
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2.5">
            Community Reports ({details.reports?.length || 0})
          </h4>

          {(!details.reports || details.reports.length === 0) ? (
            <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-500 font-medium">No community reports filed in this cell yet.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Score is derived strictly from public spatial data signals.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {details.reports.map((r) => (
                <div key={r.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-900">{r.category}</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        r.severity === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {r.severity}
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-xs text-slate-600 leading-relaxed mb-1.5">{r.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                      <span>Submitted by a community member</span>
                      <span>•</span>
                      <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Upvote / Confirm Button */}
                  <button
                    onClick={() => handleConfirmReport(r.id)}
                    disabled={confirmingId === r.id}
                    className="flex flex-col items-center justify-center p-2 bg-white hover:bg-indigo-50 border border-slate-200 rounded-xl text-slate-700 hover:text-indigo-600 transition-all active:scale-95 flex-shrink-0"
                    title="Confirm this report matches your experience"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span className="text-[10px] font-bold mt-0.5">{r.confirm_count || 0}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
