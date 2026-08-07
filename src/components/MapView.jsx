import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.heat';
import { Plus, Compass } from './Icons';

// Teardrop SVG pin
function pinSvg(fill, glow, size = 32) {
  const id = fill.replace('#', '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.4)}" viewBox="0 0 40 56">
    <defs>
      <filter id="gf${id}" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="3.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <path d="M20 2 C10.6 2 3 9.6 3 19 C3 30 20 54 20 54 C20 54 37 30 37 19 C37 9.6 29.4 2 20 2Z"
      fill="${fill}" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"
      filter="url(#gf${id})"/>
    <circle cx="20" cy="19" r="6" fill="white" opacity="0.92"/>
  </svg>`;
}

// User pin (dark body, white ring)
function userPinSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="56" viewBox="0 0 40 56">
    <defs>
      <filter id="ug" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <path d="M20 2 C10.6 2 3 9.6 3 19 C3 30 20 54 20 54 C20 54 37 30 37 19 C37 9.6 29.4 2 20 2Z"
      fill="rgba(15,23,42,0.9)" stroke="white" stroke-width="2.5" filter="url(#ug)"/>
    <circle cx="20" cy="19" r="7" fill="white"/>
    <circle cx="20" cy="19" r="3.5" fill="rgba(15,23,42,0.85)"/>
  </svg>`;
}

// Radial hotspot glow — pink/magenta, scales with report count
function hotspotGlowHtml(reportCount, radius) {
  const t = Math.min(1, reportCount / 8);
  const a1 = (0.07 + t * 0.13).toFixed(2);
  const a2 = (0.13 + t * 0.17).toFixed(2);
  const a3 = (0.28 + t * 0.28).toFixed(2);
  const r1 = radius;
  const r2 = Math.round(radius * 0.6);
  return `
    <div style="position:relative;width:${r1*2}px;height:${r1*2}px;pointer-events:none;">
      <div style="position:absolute;inset:0;border-radius:50%;
        background:radial-gradient(circle,rgba(236,72,153,${a1}) 0%,rgba(168,85,247,${a1}) 45%,transparent 70%);
        animation:hotspotPulse ${(2.5-t*0.8).toFixed(1)}s ease-out infinite;"></div>
      <div style="position:absolute;top:${r1-r2}px;left:${r1-r2}px;width:${r2*2}px;height:${r2*2}px;border-radius:50%;
        background:radial-gradient(circle,rgba(244,63,94,${a2}) 0%,rgba(236,72,153,${a2}) 45%,transparent 70%);
        animation:hotspotPulse ${(2.0-t*0.6).toFixed(1)}s ease-out infinite 0.35s;"></div>
      <div style="position:absolute;top:${r1-18}px;left:${r1-18}px;width:36px;height:36px;border-radius:50%;
        background:radial-gradient(circle,rgba(255,100,170,${a3}) 0%,transparent 70%);"></div>
    </div>`;
}

export default function MapView({
  userLocation,
  zones = [],
  heatmapPoints = [],
  selectedZone,
  onSelectZone,
  onOpenReport,
  routeData,
  activeRouteId,
  isRouteMode,
  targetLocation
}) {
  const mapRef = useRef(null);
  const leafletMapInstance = useRef(null);
  const heatLayerRef = useRef(null);
  const markersGroupRef = useRef(null);
  const glowGroupRef = useRef(null);
  const routePolylineGroupRef = useRef(null);

  const defaultCenter = [userLocation.lat || 28.6328, userLocation.lng || 77.2195];

  // 1. Init map with geographic tile
  useEffect(() => {
    if (!mapRef.current || leafletMapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: defaultCenter,
      zoom: 14,
      zoomControl: false,
      attributionControl: false
    });

    // Esri World Street Map -- geographic: shows green parks, building footprints,
    // terrain colours, water bodies, and clearly labelled streets/area names
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; <a href="https://www.esri.com">Esri</a>'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    glowGroupRef.current = L.layerGroup().addTo(map);
    markersGroupRef.current = L.layerGroup().addTo(map);
    routePolylineGroupRef.current = L.layerGroup().addTo(map);
    leafletMapInstance.current = map;

    return () => {
      if (leafletMapInstance.current) {
        leafletMapInstance.current.remove();
        leafletMapInstance.current = null;
      }
    };
  }, []);

  // 2. Fly to target / user location
  useEffect(() => {
    const map = leafletMapInstance.current;
    if (!map) return;
    if (targetLocation?.lat && targetLocation?.lng) {
      map.flyTo([targetLocation.lat, targetLocation.lng], 16, { duration: 1.2 });
    } else if (userLocation.lat && userLocation.lng) {
      const dist = L.latLng(userLocation.lat, userLocation.lng).distanceTo(map.getCenter());
      if (dist > 500 && dist < 10000) map.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 1.2 });
    }
  }, [targetLocation, userLocation.lat, userLocation.lng]);

  const handleRecenter = () => {
    const map = leafletMapInstance.current;
    if (!map) return;
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => map.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { duration: 1.2 }),
        () => userLocation.lat && map.flyTo([userLocation.lat, userLocation.lng], 16, { duration: 1.2 }),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  // 3. Heatmap -- warm colours that stand out on the light geographic base
  useEffect(() => {
    const map = leafletMapInstance.current;
    if (!map) return;
    if (heatLayerRef.current) map.removeLayer(heatLayerRef.current);
    if (heatmapPoints?.length > 0 && L.heatLayer) {
      heatLayerRef.current = L.heatLayer(heatmapPoints, {
        radius: 34,
        blur: 24,
        maxZoom: 16,
        max: 1.0,
        gradient: {
          0.0: 'rgba(99,102,241,0)',
          0.2: 'rgba(99,102,241,0.3)',
          0.5: 'rgba(245,158,11,0.45)',
          0.75: 'rgba(239,68,68,0.6)',
          1.0: 'rgba(236,72,153,0.75)'
        }
      }).addTo(map);
    }
  }, [heatmapPoints]);

  // 4. Glow overlays + teardrop pins
  useEffect(() => {
    const map = leafletMapInstance.current;
    if (!map || !markersGroupRef.current || !glowGroupRef.current) return;

    markersGroupRef.current.clearLayers();
    glowGroupRef.current.clearLayers();

    // User pin
    if (userLocation.lat && userLocation.lng && !userLocation.denied) {
      const uIcon = L.divIcon({
        className: '',
        html: userPinSvg(),
        iconSize: [40, 56],
        iconAnchor: [20, 54]
      });
      L.marker([userLocation.lat, userLocation.lng], { icon: uIcon })
        .addTo(markersGroupRef.current)
        .bindTooltip('You are here', { permanent: false, direction: 'top', className: 'nirbhay-tooltip' });
    }

    // Zone markers
    zones.forEach(zone => {
      const isSelected  = selectedZone?.cellId === zone.cellId;
      const isHigh      = zone.score > 65;
      const isMod       = zone.score > 35;
      const reportCount = zone.reportCount || 0;

      const fill = isHigh ? '#f43f5e' : isMod ? '#f59e0b' : '#06b6d4';
      const glow = isHigh ? '#ec4899' : isMod ? '#fbbf24' : '#67e8f9';
      const pSize = isHigh ? 34 : isMod ? 28 : 22;

      // Hotspot glow for high-risk or 3+ reports
      if (isHigh || reportCount >= 3) {
        const gr = Math.min(120, 55 + reportCount * 8);
        const glowIcon = L.divIcon({
          className: '',
          html: hotspotGlowHtml(reportCount, gr),
          iconSize: [gr * 2, gr * 2],
          iconAnchor: [gr, gr]
        });
        L.marker([zone.lat, zone.lng], { icon: glowIcon, interactive: false })
          .addTo(glowGroupRef.current);
      }

      // Pin
      const selRing = isSelected
        ? `<div style="position:absolute;top:-5px;left:-5px;width:${pSize+10}px;height:${Math.round(pSize*1.4)+10}px;border-radius:50% 50% 40% 40%/55% 55% 45% 45%;border:2.5px solid rgba(255,255,255,0.9);pointer-events:none;box-shadow:0 0 10px rgba(255,255,255,0.6);"></div>`
        : '';

      const pinIcon = L.divIcon({
        className: '',
        html: `<div style="position:relative;display:inline-block;">${selRing}${pinSvg(fill, glow, pSize)}</div>`,
        iconSize: [pSize, Math.round(pSize * 1.4)],
        iconAnchor: [pSize / 2, Math.round(pSize * 1.4)]
      });

      L.marker([zone.lat, zone.lng], { icon: pinIcon })
        .on('click', () => onSelectZone(zone))
        .addTo(markersGroupRef.current);
    });

  }, [zones, selectedZone, userLocation]);

  // 5. Route polylines
  useEffect(() => {
    const map = leafletMapInstance.current;
    if (!map || !routePolylineGroupRef.current) return;
    routePolylineGroupRef.current.clearLayers();
    if (isRouteMode && routeData?.routes) {
      const active = routeData.routes.find(r => r.id === activeRouteId) || routeData.routes[0];
      if (active?.coordinates) {
        const poly = L.polyline(active.coordinates, {
          color: active.isRecommended ? '#4f46e5' : '#64748b',
          weight: 5, opacity: 0.85, lineCap: 'round', lineJoin: 'round'
        }).addTo(routePolylineGroupRef.current);
        map.fitBounds(poly.getBounds(), { padding: [60, 60] });
      }
    }
  }, [isRouteMode, routeData, activeRouteId]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* Severity legend */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-4 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 shadow text-xs font-semibold text-slate-700 pointer-events-none">
        <span className="font-bold text-slate-500">Severity:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{background:'#f43f5e',boxShadow:'0 0 5px #f43f5e'}}/>High
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{background:'#f59e0b',boxShadow:'0 0 5px #f59e0b'}}/>Medium
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{background:'#06b6d4',boxShadow:'0 0 5px #06b6d4'}}/>Low
        </span>
      </div>

      {/* Recenter */}
      <button
        onClick={handleRecenter}
        className="absolute bottom-24 right-5 z-20 w-11 h-11 bg-white hover:bg-slate-50 text-slate-700 rounded-full shadow-lg flex items-center justify-center border border-slate-200 transition-all active:scale-95 group"
        title="Recenter"
      >
        <Compass className="w-5 h-5 text-indigo-500 group-hover:rotate-45 transition-transform duration-300" />
      </button>

      {/* Report Hazard */}
      {!isRouteMode && (
        <button
          onClick={onOpenReport}
          className="absolute bottom-8 right-16 z-20 flex items-center gap-2 px-5 py-3.5 bg-[#0B0F2E] hover:bg-indigo-950 text-white font-bold text-sm rounded-full shadow-2xl transition-all active:scale-95 border border-indigo-500/30"
        >
          <Plus className="w-5 h-5 text-indigo-400" />
          <span>Report Hazard</span>
        </button>
      )}
    </div>
  );
}
