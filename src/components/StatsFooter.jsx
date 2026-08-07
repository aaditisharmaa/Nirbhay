import React, { useEffect, useState } from 'react';
import { Target } from './Icons';

export default function StatsFooter() {
  const [stats, setStats] = useState({ totalReports: 52, zonesMapped: 148 });

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStats({
            totalReports: data.totalReports ?? stats.totalReports,
            zonesMapped: data.zonesMapped ?? stats.zonesMapped
          });
        }
      })
      .catch(err => console.warn('Stats fetch warn:', err));
  }, []);

  return (
    <div className="absolute bottom-4 left-0 right-0 z-20 pointer-events-none px-5">
      <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 text-center text-[15px] font-semibold italic leading-snug text-amber-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] [&>span:nth-last-child(-n+2)]:hidden sm:text-lg">
        <Target className="h-6 w-6 flex-none text-white" strokeWidth={1.8} />
        <span>Nearby safety report: {stats.totalReports} issues mapped around you (100m)</span>
        <span>•</span>
        <span>{stats.zonesMapped} Grid Zones Mapped</span>
      </div>
    </div>
  );
}
