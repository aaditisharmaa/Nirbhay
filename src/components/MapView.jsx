import React, { useEffect, useRef, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet.heat';
import { Plus, Compass } from './Icons';

// ── Category colour palette — spread across the hue wheel for visual distinctness ──
const CATEGORY_COLORS = {
  'Poor Lighting':      '#7c3aed', // violet
  'Harassment':         '#e11d48', // rose-600
  'Stalking':           '#b91c1c', // red-700
  'Deserted Area':      '#475569', // slate-600
  'Theft & Snatching':  '#d97706', // amber-600
  'Eve Teasing':        '#db2777', // pink-600
  'Unsafe Transport':   '#0284c7', // sky-600
  'Infrastructure':     '#78716c', // stone-500
};

// Single-codepoint glyphs safe in SVG <text>
const CATEGORY_GLYPHS = {
  'Poor Lighting':      '\uD83D\uDD26', // 🔦
  'Harassment':         '!',
  'Stalking':           '\uD83D\uDC41',
  'Deserted Area':      '\uD83C\uDFDA',
  'Theft & Snatching':  '\uD83C\uDF92',
  'Eve Teasing':        '\u2715',
  'Unsafe Transport':   '\uD83D\uDE8C',
  'Infrastructure':     '\u26A0',
};

// ── Flat circular badge pin (no blur, no animation) ──────────────────────────
// size: diameter of the circle in px
// count: if >0, show a count badge top-right
// showMoon: if true, show 🌙 bottom-left for dark-at-night zones
function circlePinHtml(fill, glyph, size, count = 0, showMoon = false, isSelected = false) {
  const r = size / 2;
  const fontSize = Math.round(size * 0.36);
  const borderColor = isSelected ? '#fff' : 'rgba(255,255,255,0.85)';
  const borderWidth = isSelected ? 2.5 : 1.5;
  const shadow = isSelected
    ? `drop-shadow(0 0 6px ${fill}) drop-shadow(0 2px 4px rgba(0,0,0,0.5))`
    : 'drop-shadow(0 2px 4px rgba(0,0,0,0.45))';

  const countBadge = count > 0 ? `
    <div style="
      position:absolute;top:-5px;right:-5px;
      min-width:16px;height:16px;padding:0 3px;
      border-radius:8px;
      background:#ef4444;border:1.5px solid white;
      color:white;font-size:9px;font-weight:900;font-family:sans-serif;
      display:flex;align-items:center;justify-content:center;
      line-height:1;
    ">${count > 99 ? '99+' : count}</div>` : '';

  const moonBadge = showMoon ? `
    <div style="
      position:absolute;bottom:-4px;left:-4px;
      width:14px;height:14px;border-radius:50%;
      background:rgba(30,0,80,0.85);border:1px solid rgba(167,139,250,0.8);
      font-size:9px;display:flex;align-items:center;justify-content:center;
      line-height:1;
    ">\uD83C\uDF19</div>` : '';

  return `<div style="
    position:relative;
    width:${size}px;height:${size}px;
    border-radius:50%;
    background:${fill};
    border:${borderWidth}px solid ${borderColor};
    display:flex;align-items:center;justify-content:center;
    filter:${shadow};
    box-sizing:border-box;
  ">
    <span style="font-size:${fontSize}px;line-height:1;display:block;">${glyph}</span>
    ${countBadge}
    ${moonBadge}
  </div>`;
}

// User location — white dot with indigo ring
function userDotHtml() {
  return `<div style="
    width:16px;height:16px;border-radius:50%;
    background:#fff;
    border:2.5px solid #4f46e5;
    box-shadow:0 0 0 4px rgba(79,70,229,0.25),0 2px 6px rgba(0,0,0,0.4);
  "></div>`;
}

// Police station flat badge — navy shield, no glow, no animation
function policePinHtml(size = 22) {
  return `<div style="
    width:${size}px;height:${size}px;border-radius:4px;
    background:rgba(30,58,138,0.92);
    border:1.5px solid rgba(147,197,253,0.7);
    display:flex;align-items:center;justify-content:center;
    box-sizing:border-box;
    filter:drop-shadow(0 2px 3px rgba(0,0,0,0.5));
  "><span style="font-size:${Math.round(size*0.52)}px;line-height:1;">\uD83D\uDEA8</span></div>`;
}

export default function MapView({
  userLocation = {},
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
  const mapRef               = useRef(null);
  const leafletMapInstance   = useRef(null);
  const heatLayerRef         = useRef(null);
  const markersGroupRef      = useRef(null);
  const policeGroupRef       = useRef(null);
  const routePolylineGroupRef = useRef(null);
  const debounceRef          = useRef(null);
  // Keep latest props available in map event callbacks without re-binding
  const zonesRef             = useRef(zones);
  const selectedZoneRef      = useRef(selectedZone);
  const userLocationRef      = useRef(userLocation);
  const onSelectZoneRef      = useRef(onSelectZone);
  const policeStationsRef    = useRef([]);

  useEffect(() => { zonesRef.current = zones; }, [zones]);
  useEffect(() => { selectedZoneRef.current = selectedZone; }, [selectedZone]);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);
  useEffect(() => { onSelectZoneRef.current = onSelectZone; }, [onSelectZone]);

  // Fetch police stations once on mount
  useEffect(() => {
    fetch('/api/map-features')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          policeStationsRef.current = data.policeStations ?? [];
          renderVisibleMarkers();
        }
      })
      .catch(() => {});
  }, []);

  const defaultCenter = [userLocation.lat || 28.6328, userLocation.lng || 77.2195];

  // ── Viewport-based marker rendering ──────────────────────────────────────
  const renderVisibleMarkers = useCallback(() => {
    const map = leafletMapInstance.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    if (policeGroupRef.current) policeGroupRef.current.clearLayers();

    const bounds = map.getBounds().pad(0.15);
    const zones = zonesRef.current;
    const selectedZone = selectedZoneRef.current;
    const userLoc = userLocationRef.current;

    // User pin
    if (userLoc.lat && userLoc.lng && !userLoc.denied) {
      const uIcon = L.divIcon({
        className: '',
        html: userDotHtml(),
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      L.marker([userLoc.lat, userLoc.lng], { icon: uIcon })
        .addTo(group)
        .bindTooltip('You are here', { permanent: false, direction: 'top', className: 'nirbhay-tooltip' });
    }

    // Police station markers — flat navy badge, viewport-culled
    if (policeGroupRef.current) {
      policeStationsRef.current.forEach(ps => {
        if (!bounds.contains([ps.lat, ps.lng])) return;
        const icon = L.divIcon({
          className: '',
          html: policePinHtml(22),
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });
        L.marker([ps.lat, ps.lng], { icon })
          .addTo(policeGroupRef.current)
          .bindTooltip('Police Station', { permanent: false, direction: 'top', className: 'nirbhay-tooltip' });
      });
    }

    // Hazard zone markers
    zones.forEach(zone => {
      if (!bounds.contains([zone.lat, zone.lng])) return;

      try {
        const isSelected    = selectedZone?.cellId === zone.cellId;
        const isHigh        = zone.score > 65;
        const isMod         = zone.score > 35;
        const reportCount   = zone.reportCount || 0;

        const dominantCat   = zone.categoryCounts
          ? Object.entries(zone.categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
          : null;
        const fill   = CATEGORY_COLORS[dominantCat] ?? (isHigh ? '#e11d48' : isMod ? '#d97706' : '#0284c7');
        const glyph  = CATEGORY_GLYPHS[dominantCat] ?? '!';
        const size   = isHigh ? 36 : isMod ? 28 : 22;

        const isNight      = zone.signals?.isDaytime === false;
        const dimLighting  = (zone.signals?.streetlightsCount ?? 0) < 2;
        const showMoon     = isNight && dimLighting;
        // Count badge: show only for hotspots (3+ reports), cap at 99
        const badgeCount   = reportCount >= 3 ? reportCount : 0;

        const icon = L.divIcon({
          className: '',
          html: circlePinHtml(fill, glyph, size, badgeCount, showMoon, isSelected),
          iconSize:   [size + 14, size + 14],  // extra room for count/moon badges
          iconAnchor: [(size + 14) / 2, (size + 14) / 2]
        });

        L.marker([zone.lat, zone.lng], { icon })
          .on('click', () => onSelectZoneRef.current(zone))
          .addTo(group);
      } catch (e) {
        console.warn('Marker error zone', zone.cellId, e.message);
      }
    });
  }, []); // stable — reads from refs

  // Debounced re-render on map move/zoom
  const scheduleRender = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(renderVisibleMarkers, 120);
  }, [renderVisibleMarkers]);

  // 1. Init map
  useEffect(() => {
    if (!mapRef.current || leafletMapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: defaultCenter,
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,   // faster DOM rendering
      zoomSnap: 0.5,        // smoother zoom steps
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri'
    }).addTo(map);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, opacity: 0.8
    }).addTo(map);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, opacity: 0.9
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    markersGroupRef.current      = L.layerGroup().addTo(map);
    policeGroupRef.current       = L.layerGroup().addTo(map);
    routePolylineGroupRef.current = L.layerGroup().addTo(map);
    leafletMapInstance.current   = map;

    // Re-render markers on viewport change (debounced)
    map.on('moveend zoomend', scheduleRender);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
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

  // 3. Heatmap
  useEffect(() => {
    const map = leafletMapInstance.current;
    if (!map) return;
    if (heatLayerRef.current) map.removeLayer(heatLayerRef.current);
    if (heatmapPoints?.length > 0 && L.heatLayer) {
      heatLayerRef.current = L.heatLayer(heatmapPoints, {
        radius: 34, blur: 24, maxZoom: 16, max: 1.0,
        gradient: {
          0.0:  'rgba(99,102,241,0)',
          0.2:  'rgba(99,102,241,0.3)',
          0.5:  'rgba(245,158,11,0.45)',
          0.75: 'rgba(239,68,68,0.6)',
          1.0:  'rgba(236,72,153,0.75)'
        }
      }).addTo(map);
    }
  }, [heatmapPoints]);

  // 4. Re-render markers when zones or selection changes
  useEffect(() => {
    renderVisibleMarkers();
  }, [zones, selectedZone, userLocation, renderVisibleMarkers]);

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

      {/* Compact category legend */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-sm border border-white/10 shadow text-[10px] font-semibold text-white/80 pointer-events-none flex-wrap justify-center max-w-xs">
        {[
          { color:'#7c3aed', label:'Lighting' },
          { color:'#e11d48', label:'Harassment' },
          { color:'#d97706', label:'Theft' },
          { color:'#b91c1c', label:'Stalking' },
          { color:'#db2777', label:'Eve Teasing' },
          { color:'#475569', label:'Deserted' },
          { color:'#0284c7', label:'Transport' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span style={{ width:8,height:8,borderRadius:'50%',background:color,display:'inline-block',flexShrink:0 }}/>
            {label}
          </span>
        ))}
      </div>

      {/* Recenter */}
      <button
        onClick={handleRecenter}
        className="absolute bottom-24 right-5 z-20 w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 group"
        style={{background:'rgba(15,23,42,0.82)',border:'1px solid rgba(255,255,255,0.2)',boxShadow:'0 2px 12px rgba(0,0,0,0.4)'}}
        title="Recenter"
      >
        <Compass className="w-5 h-5 text-white group-hover:rotate-45 transition-transform duration-300" />
      </button>

      {/* Report Hazard */}
      {!isRouteMode && (
        <button
          onClick={onOpenReport}
          className="absolute bottom-8 right-16 z-20 flex items-center gap-2 px-5 py-3.5 font-bold text-sm rounded-full transition-all active:scale-95 text-white"
          style={{background:'rgba(11,15,46,0.88)',border:'1px solid rgba(99,102,241,0.5)',boxShadow:'0 0 18px rgba(99,102,241,0.4)',backdropFilter:'blur(8px)'}}
        >
          <Plus className="w-5 h-5 text-indigo-300" />
          <span>Report Hazard</span>
        </button>
      )}
    </div>
  );
}
