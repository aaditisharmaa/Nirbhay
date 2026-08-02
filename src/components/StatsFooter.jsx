import React, { useEffect, useState } from 'react';
import { Shield } from './Icons';

export default function StatsFooter() {
  const [stats, setStats] = useState({ totalReports: 52, zonesMapped: 148 });

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStats({ totalReports: data.totalReports, zonesMapped: data.zonesMapped });
        }
      })
      .catch(err => console.warn('Stats fetch warn:', err));
  }, []);

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
      <div className="px-3.5 py-1 bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-full shadow-md text-[10px] font-extrabold text-slate-600 flex items-center gap-2 tracking-wide uppercase">
        <Shield className="w-3 h-3 text-indigo-600" />
        <span>{stats.totalReports} Reports Collected</span>
        <span>•</span>
        <span>{stats.zonesMapped} Grid Zones Mapped</span>
      </div>
    </div>
  );
}
