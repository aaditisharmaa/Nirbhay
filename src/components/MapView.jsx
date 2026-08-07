import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.heat';
import { Plus, Compass } from './Icons';

// Teardrop SVG pin — matches the reference image exactly
function pinSvg(fill, glow, size = 32) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size * 1.4}" viewBox="0 0 40 56">
    <defs>
      <filter id="g${fill.replace('#','')}" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <ellipse cx="20" cy="20" rx="15" ry="15" fill="${glow}" opacity="0.35" filter="url(#g${fill.replace('#','')})"/>
    <path d="M20 2 C10.6 2 3 9.6 3 19 C3 30 20 54 20 54 C20 54 37 30 37 19 C37 9.6 29.4 2 20 2Z"
      fill="${fill}" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"
      filter="url(#g${fill.replace('#','')})"/>
    <circle cx="20" cy="19" r="6" fill="white" opacity="0.9"/>
  </svg>`;
}

// User location pin (white with black center, like the reference)
function userPinSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="56" viewBox="0 0 40 56">
    <defs>
      <filter id="userGlow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <path d="M20 2 C10.6 2 3 9.6 3 19 C3 30 20 54 20 54 C20 54 37 30 37 19 C37 9.6 29.4 2 20 2Z"
      fill="rgba(30,30,50,0.85)" stroke="rgba(255,255,255,0.9)" stroke-width="2.5" filter="url(#userGlow)"/>
    <circle cx="20" cy="19" r="7" fill="white"/>
    <circle cx="20" cy="19" r="3.5" fill="rgba(30,30,50,0.9)"/>
  </svg>`;
}

// Radial glow overlay for hotspot zones (pink/magenta like the reference)
function hotspotGlowHtml(reportCount, size) {
  const intensity = Math.min(1, reportCount / 8); // max at 8+ reports
  const r1 = size;
  const r2 = size * 0.6;
  const alpha1 = (0.06 + intensity * 0.12).toFixed(2);
  const alpha2 = (0.10 + intensity * 0.18).toFixed(2);
  const alpha3 = (0.25 + intensity * 0.30).toFixed(2);
  return `
    <div style="position:relative;width:${r1*2}px;height:${r1*2}px;pointer-events:none;">
      <!-- Outer glow ring -->
      <div style="
        position:absolute;inset:0;border-radius:50%;
        background:radial-gradient(circle, rgba(236,72,153,${alpha1}) 0%, rgba(168,85,247,${alpha1}) 40%, transparent 70%);
        animation:hotspotPulse ${2.5 - intensity*0.8}s ease-out infinite;
      "></div>
      <!-- Inner glow ring -->
      <div style="
        position:absolute;
        top:${r1-r2}px;left:${r1-r2}px;
        width:${r2*2}px;height:${r2*2}px;
        border-radius:50%;
        background:radial-gradient(circle, rgba(244,63,94,${alpha2}) 0%, rgba(236,72,153,${alpha2}) 40%, transparent 70%);
        animation:hotspotPulse ${2.0 - intensity*0.6}s ease-out infinite 0.4s;
      "></div>
      <!-- Core bright centre -->
      <div style="
        position:absolute;
        top:${r1-18}px;left:${r1-18}px;
        width:36px;height:36px;border-radius:50%;
        background:radial-gradient(circle, rgba(255,120,180,${alpha3}) 0%, transparent 70%);
      "></div>
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

  // 1. Init map
  useEffect(() => {
    if (!mapRef.current || leafletMapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: defaultCenter,
      zoom: 14,
      zoomControl: false,
      attributionControl: false
    });

    // Dark navy/purple tile base — CartoDB Dark Matter
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // Blue-purple colour tint overlay to match the reference image's deep blue feel
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      opacity: 0.3,
      className: 'map-tint-layer'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    glowGroupRef.current = L.layerGroup().addTo(map);   // glow below markers
    markersGroupRef.current = L.layerGroup().addTo(map); // pins on top
    routePolylineGroupRef.current = L.layerGroup().addTo(map);
    leafletMapInstance.current = map;

    return () => {
      if (leafletMapInstance.current) {
        leafletMapInstance.current.remove();
        leafletMapInstance.current = null;
      }
    };
  }, []);

  // 2. Fly to target
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

  // 3. Heatmap — subtle, sits under the glowing pins
  useEffect(() => {
    const map = leafletMapInstance.current;
    if (!map) return;
    if (heatLayerRef.current) map.removeLayer(heatLayerRef.current);
    if (heatmapPoints?.length > 0 && L.heatLayer) {
      heatLayerRef.current = L.heatLayer(heatmapPoints, {
        radius: 40,
        blur: 30,
        maxZoom: 16,
        max: 1.0,
        gradient: {
          0.0: 'rgba(88,28,220,0)',
          0.25: 'rgba(88,28,220,0.2)',
          0.5: 'rgba(168,85,247,0.3)',
          0.75: 'rgba(236,72,153,0.45)',
          1.0: 'rgba(244,63,94,0.6)'
        }
      }).addTo(map);
    }
  }, [heatmapPoints]);

  // 4. Glow overlays + Pin markers
  useEffect(() => {
    const map = leafletMapInstance.current;
    if (!map || !markersGroupRef.current || !glowGroupRef.current) return;

    markersGroupRef.current.clearLayers();
    glowGroupRef.current.clearLayers();

    // User pin
    if (userLocation.lat && userLocation.lng && !userLocation.denied) {
      const userIcon = L.divIcon({
        className: '',
        html: userPinSvg(),
        iconSize: [40, 56],
        iconAnchor: [20, 54]
      });
      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(markersGroupRef.current)
        .bindTooltip('You are here', {
          permanent: false, direction: 'top',
          className: 'nirbhay-tooltip'
        });
    }

    // Zone markers
    zones.forEach(zone => {
      const isSelected  = selectedZone?.cellId === zone.cellId;
      const isHigh      = zone.score > 65;
      const isMod       = zone.score > 35;
      const reportCount = zone.reportCount || 0;

      // Pin colours matching the reference: red=high, amber=medium, cyan=low
      const fill  = isHigh ? '#f43f5e' : isMod ? '#f59e0b' : '#06b6d4';
      const glow  = isHigh ? '#ec4899' : isMod ? '#fbbf24' : '#67e8f9';
      const pSize = isHigh ? 34 : isMod ? 28 : 22;

      // --- Radial glow overlay for hotspots ---
      // Show for high-risk zones or any zone with 3+ reports
      const showGlow = isHigh || reportCount >= 3;
      if (showGlow) {
        // Scale glow radius with report density
        const glowRadius = Math.min(120, 60 + reportCount * 8);
        const glowIcon = L.divIcon({
          className: '',
          html: hotspotGlowHtml(reportCount, glowRadius),
          iconSize: [glowRadius * 2, glowRadius * 2],
          iconAnchor: [glowRadius, glowRadius]
        });
        L.marker([zone.lat, zone.lng], { icon: glowIcon, interactive: false })
          .addTo(glowGroupRef.current);
      }

      // --- Teardrop pin ---
      const selectionRing = isSelected
        ? `<div style="
            position:absolute;top:-6px;left:-6px;
            width:${pSize+12}px;height:${pSize*1.4+12}px;
            border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;
            border:2px solid rgba(255,255,255,0.8);
            pointer-events:none;
          "></div>` : '';

      const pinIcon = L.divIcon({
        className: '',
        html: `<div style="position:relative;display:inline-block;">
          ${selectionRing}
          ${pinSvg(fill, glow, pSize)}
        </div>`,
        iconSize: [pSize, pSize * 1.4],
        iconAnchor: [pSize / 2, pSize * 1.4]
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
      const activeRoute = routeData.routes.find(r => r.id === activeRouteId) || routeData.routes[0];
      if (activeRoute?.coordinates) {
        const poly = L.polyline(activeRoute.coordinates, {
          color: activeRoute.isRecommended ? '#a78bfa' : '#64748b',
          weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round'
        }).addTo(routePolylineGroupRef.current);
        map.fitBounds(poly.getBounds(), { padding: [60, 60] });
      }
    }
  }, [isRouteMode, routeData, activeRouteId]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* Severity legend — matching the reference */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-4 py-1.5 rounded-full bg-slate-900/70 backdrop-blur-sm border border-white/10 text-xs font-semibold text-white/80 pointer-events-none">
        <span className="font-bold text-white/60">Severity:</span>
        <span className="flex items-center gap-1.5"><span style={{background:'#f43f5e',boxShadow:'0 0 6px #f43f5e'}} className="w-2.5 h-2.5 rounded-full inline-block"/>High</span>
        <span className="flex items-center gap-1.5"><span style={{background:'#f59e0b',boxShadow:'0 0 6px #f59e0b'}} className="w-2.5 h-2.5 rounded-full inline-block"/>Medium</span>
        <span className="flex items-center gap-1.5"><span style={{background:'#06b6d4',boxShadow:'0 0 6px #06b6d4'}} className="w-2.5 h-2.5 rounded-full inline-block"/>Low</span>
      </div>

      {/* Recenter button */}
      <button
        onClick={handleRecenter}
        className="absolute bottom-24 right-5 z-20 w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95"
        style={{background:'rgba(15,23,42,0.85)',border:'1px solid rgba(168,85,247,0.4)',boxShadow:'0 0 12px rgba(168,85,247,0.3)'}}
        title="Recenter"
      >
        <Compass className="w-5 h-5 text-purple-300" />
      </button>

      {/* Report Hazard button */}
      {!isRouteMode && (
        <button
          onClick={onOpenReport}
          className="absolute bottom-8 right-16 z-20 flex items-center gap-2 px-5 py-3.5 font-bold text-sm rounded-full transition-all active:scale-95 text-white"
          style={{background:'rgba(99,102,241,0.85)',border:'1px solid rgba(168,85,247,0.5)',boxShadow:'0 0 20px rgba(99,102,241,0.5)',backdropFilter:'blur(8px)'}}
        >
          <Plus className="w-5 h-5 text-indigo-200" />
          <span>Report Hazard</span>
        </button>
      )}
    </div>
  );
}
