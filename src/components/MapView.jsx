import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.heat';
import { Plus, Navigation, Compass } from './Icons';

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
  const routePolylineGroupRef = useRef(null);

  const defaultCenter = [userLocation.lat || 28.6328, userLocation.lng || 77.2195];

  // 1. Initialize Leaflet Map with dark tile theme
  useEffect(() => {
    if (!mapRef.current || leafletMapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: defaultCenter,
      zoom: 14,
      zoomControl: false,
      attributionControl: false
    });

    // Dark map tiles — CartoDB Dark Matter
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // Minimal attribution
    L.control.attribution({ position: 'bottomleft', prefix: false })
      .addAttribution('© <a href="https://carto.com">CARTO</a>')
      .addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

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
    } else if (userLocation.lat) {
      map.flyTo([userLocation.lat, userLocation.lng], 16, { duration: 1.2 });
    }
  };

  // 3. Heatmap with dark-theme colours
  useEffect(() => {
    const map = leafletMapInstance.current;
    if (!map) return;
    if (heatLayerRef.current) map.removeLayer(heatLayerRef.current);
    if (heatmapPoints?.length > 0 && L.heatLayer) {
      heatLayerRef.current = L.heatLayer(heatmapPoints, {
        radius: 32,
        blur: 22,
        maxZoom: 16,
        max: 1.0,
        gradient: {
          0.0: 'rgba(99,102,241,0)',    // transparent at very low
          0.2: 'rgba(99,102,241,0.4)',  // indigo — safe
          0.5: 'rgba(245,158,11,0.6)',  // amber — moderate
          0.75: 'rgba(239,68,68,0.75)', // red
          1.0: 'rgba(236,72,153,0.9)'   // hot pink — very high
        }
      }).addTo(map);
    }
  }, [heatmapPoints]);

  // 4. Markers — glowing pins & pulsing rings
  useEffect(() => {
    const map = leafletMapInstance.current;
    if (!map || !markersGroupRef.current) return;
    markersGroupRef.current.clearLayers();

    // User location — white pulsing dot
    if (userLocation.lat && userLocation.lng && !userLocation.denied) {
      const userIcon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
            <div style="
              position:absolute;width:22px;height:22px;border-radius:50%;
              background:rgba(255,255,255,0.2);
              animation:userPing 1.8s ease-out infinite;
            "></div>
            <div style="
              width:12px;height:12px;border-radius:50%;
              background:#ffffff;
              border:2px solid rgba(255,255,255,0.8);
              box-shadow:0 0 12px rgba(255,255,255,0.9);
            "></div>
          </div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(markersGroupRef.current)
        .bindTooltip('You are here', { permanent: false, direction: 'top', className: 'dark-tooltip' });
    }

    // Risk zone markers
    zones.forEach(zone => {
      const isSelected = selectedZone?.cellId === zone.cellId;
      const isHigh     = zone.score > 65;
      const isMod      = zone.score > 35 && zone.score <= 65;

      // Colour palette matching the reference image
      const glowColor  = isHigh ? '#ec4899' : isMod ? '#f59e0b' : '#06b6d4'; // pink / amber / cyan
      const dotColor   = isHigh ? '#f43f5e' : isMod ? '#fbbf24' : '#22d3ee';
      const ringColor  = isHigh ? 'rgba(236,72,153,' : isMod ? 'rgba(251,191,36,' : 'rgba(34,211,238,';
      const size       = isHigh ? 14 : isMod ? 11 : 9;

      let html = '';

      if (zone.isAnomaly || isHigh) {
        // Glowing pulsing ring for high-risk / anomaly zones
        html = `
          <div style="position:relative;width:${size*4}px;height:${size*4}px;display:flex;align-items:center;justify-content:center;">
            <div style="
              position:absolute;border-radius:50%;
              width:${size*4}px;height:${size*4}px;
              background:${ringColor}0.08)};
              border:1.5px solid ${ringColor}0.3)};
              animation:glowRingOuter 2.4s ease-out infinite;
            "></div>
            <div style="
              position:absolute;border-radius:50%;
              width:${size*2.4}px;height:${size*2.4}px;
              background:${ringColor}0.14)};
              border:1.5px solid ${ringColor}0.5)};
              animation:glowRingInner 2.4s ease-out infinite 0.3s;
            "></div>
            <div style="
              width:${size}px;height:${size}px;border-radius:50%;
              background:${dotColor};
              box-shadow:0 0 ${isSelected ? 18 : 10}px ${glowColor}, 0 0 ${isSelected ? 32 : 18}px ${ringColor}0.5)};
              border:2px solid rgba(255,255,255,0.6);
              transition:box-shadow 0.2s;
            "></div>
          </div>`;
      } else {
        // Simple glowing dot for low / moderate
        html = `
          <div style="position:relative;width:${size*2.5}px;height:${size*2.5}px;display:flex;align-items:center;justify-content:center;">
            <div style="
              width:${size}px;height:${size}px;border-radius:50%;
              background:${dotColor};
              box-shadow:0 0 8px ${glowColor}, 0 0 16px ${ringColor}0.35)};
              border:2px solid rgba(255,255,255,0.5);
              ${isSelected ? `outline:2px solid white;outline-offset:3px;` : ''}
            "></div>
          </div>`;
      }

      const icon = L.divIcon({
        className: '',
        html,
        iconSize: [isHigh || zone.isAnomaly ? size*4 : size*2.5, isHigh || zone.isAnomaly ? size*4 : size*2.5],
        iconAnchor: [isHigh || zone.isAnomaly ? size*2 : size*1.25, isHigh || zone.isAnomaly ? size*2 : size*1.25]
      });

      L.marker([zone.lat, zone.lng], { icon })
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
        const polyline = L.polyline(activeRoute.coordinates, {
          color: activeRoute.isRecommended ? '#818cf8' : '#64748b',
          weight: 5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(routePolylineGroupRef.current);
        map.fitBounds(polyline.getBounds(), { padding: [60, 60] });
      }
    }
  }, [isRouteMode, routeData, activeRouteId]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* Recenter button — dark theme */}
      <button
        onClick={handleRecenter}
        className="absolute bottom-24 right-5 z-20 w-11 h-11 bg-slate-800/90 hover:bg-slate-700 text-white rounded-full shadow-2xl flex items-center justify-center border border-slate-600/60 transition-all active:scale-95 group backdrop-blur-sm"
        title="Recenter to My Location"
      >
        <Compass className="w-5 h-5 text-indigo-300 group-hover:text-white group-hover:rotate-45 transition-transform duration-300" />
      </button>

      {/* Report Hazard button */}
      {!isRouteMode && (
        <button
          onClick={onOpenReport}
          className="absolute bottom-8 right-16 z-20 flex items-center gap-2 px-5 py-3.5 bg-indigo-600/90 hover:bg-indigo-500 backdrop-blur-sm text-white font-bold text-sm rounded-full shadow-[0_0_20px_rgba(99,102,241,0.5)] transition-all active:scale-95 border border-indigo-400/40"
        >
          <Plus className="w-5 h-5 text-indigo-200" />
          <span>Report Hazard</span>
        </button>
      )}
    </div>
  );
}
