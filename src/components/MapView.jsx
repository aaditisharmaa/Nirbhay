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

  // Default Center: Connaught Place, Delhi
  const defaultCenter = [userLocation.lat || 28.6328, userLocation.lng || 77.2195];

  // 1. Initialize Leaflet Map Instance
  useEffect(() => {
    if (!mapRef.current || leafletMapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: defaultCenter,
      zoom: 14,
      zoomControl: false,
      attributionControl: false
    });

    // Clean Google-Maps-like Voyager light tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // Zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Layer groups for markers & routes
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

  // 2. Update Map Center when target location or live user location updates
  useEffect(() => {
    const map = leafletMapInstance.current;
    if (!map) return;

    if (targetLocation && targetLocation.lat && targetLocation.lng) {
      map.flyTo([targetLocation.lat, targetLocation.lng], 16, { duration: 1.2 });
    } else if (userLocation.lat && userLocation.lng) {
      const currentCenter = map.getCenter();
      const dist = L.latLng(userLocation.lat, userLocation.lng).distanceTo(currentCenter);
      if (dist > 500 && dist < 10000) {
        map.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 1.2 });
      }
    }
  }, [targetLocation, userLocation.lat, userLocation.lng]);

  // Issue 3: Recenter Map to User's High-Precision Live Location
  const handleRecenter = () => {
    const map = leafletMapInstance.current;
    if (!map) return;

    const geoOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          map.flyTo([lat, lng], 16, { duration: 1.2 });
        },
        () => {
          if (userLocation.lat && userLocation.lng) {
            map.flyTo([userLocation.lat, userLocation.lng], 16, { duration: 1.2 });
          }
        },
        geoOptions
      );
    } else if (userLocation.lat && userLocation.lng) {
      map.flyTo([userLocation.lat, userLocation.lng], 16, { duration: 1.2 });
    }
  };

  // 3. Render Leaflet.heat Risk Heatmap Overlay
  useEffect(() => {
    const map = leafletMapInstance.current;
    if (!map) return;

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
    }

    if (heatmapPoints && heatmapPoints.length > 0 && L.heatLayer) {
      heatLayerRef.current = L.heatLayer(heatmapPoints, {
        radius: 28,
        blur: 20,
        maxZoom: 16,
        max: 1.0,
        gradient: {
          0.2: '#10B981', // Green safe
          0.5: '#F59E0B', // Yellow moderate
          0.8: '#EF4444'  // Red high risk
        }
      }).addTo(map);
    }
  }, [heatmapPoints]);

  // 4. Render Custom Geometric & Pulsing Anomaly Markers across entire NCR region
  useEffect(() => {
    const map = leafletMapInstance.current;
    if (!map || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();

    // User Location Pin with pulsating radius
    if (userLocation.lat && userLocation.lng && !userLocation.denied) {
      const userMarkerIcon = L.divIcon({
        className: 'custom-user-pin',
        html: `<div class="user-location-pulse"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });
      L.marker([userLocation.lat, userLocation.lng], { icon: userMarkerIcon })
        .addTo(markersGroupRef.current)
        .bindTooltip('You are here', { permanent: false, direction: 'top' });
    }

    // Render Geometric Markers for Moderate/High Risk Zones & Feature 3 Anomaly Pulsing Rings
    zones.forEach(zone => {
      const isSelected = selectedZone && selectedZone.cellId === zone.cellId;
      const sizePx = zone.score > 65 ? 26 : (zone.score > 35 ? 20 : 16);

      let markerClass = 'risk-marker-low';
      if (zone.score > 65) markerClass = 'risk-marker-high';
      else if (zone.score > 35) markerClass = 'risk-marker-moderate';

      let customHtml = '';
      if (zone.isAnomaly) {
        customHtml = `
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-rose-500 opacity-75"></span>
            <div class="risk-marker-diamond risk-marker-high ring-4 ring-rose-600 scale-125 shadow-[0_0_15px_rgba(225,29,72,0.8)]" style="width:24px; height:24px;">
              <span class="text-[10px] font-black text-white transform -rotate-45">!</span>
            </div>
          </div>
        `;
      } else {
        customHtml = `
          <div class="risk-marker-diamond ${markerClass} ${isSelected ? 'ring-4 ring-indigo-500 scale-125' : ''}" style="width:${sizePx}px; height:${sizePx}px;">
          </div>
        `;
      }

      const divIcon = L.divIcon({
        className: 'custom-risk-icon',
        html: customHtml,
        iconSize: [sizePx + 8, sizePx + 8],
        iconAnchor: [(sizePx + 8) / 2, (sizePx + 8) / 2]
      });

      const marker = L.marker([zone.lat, zone.lng], { icon: divIcon });
      marker.on('click', () => {
        onSelectZone(zone);
      });
      markersGroupRef.current.addLayer(marker);
    });

  }, [zones, selectedZone, userLocation]);

  // 5. Render Color-Segmented Route Lines when in Route Mode
  useEffect(() => {
    const map = leafletMapInstance.current;
    if (!map || !routePolylineGroupRef.current) return;

    routePolylineGroupRef.current.clearLayers();

    if (isRouteMode && routeData && routeData.routes) {
      const activeRoute = routeData.routes.find(r => r.id === activeRouteId) || routeData.routes[0];

      if (activeRoute && activeRoute.coordinates) {
        const polyline = L.polyline(activeRoute.coordinates, {
          color: activeRoute.isRecommended ? '#4F46E5' : '#64748B',
          weight: 6,
          opacity: 0.8,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(routePolylineGroupRef.current);

        map.fitBounds(polyline.getBounds(), { padding: [60, 60] });
      }
    }
  }, [isRouteMode, routeData, activeRouteId]);

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Recenter button — above the Report Hazard button */}
      <button
        onClick={handleRecenter}
        className="absolute bottom-24 right-5 z-20 w-11 h-11 bg-white hover:bg-slate-50 text-slate-700 hover:text-indigo-600 rounded-full shadow-2xl flex items-center justify-center border border-slate-200 transition-all active:scale-95 group"
        title="Recenter Map to My Live GPS Location"
      >
        <Compass className="w-6 h-6 text-slate-700 group-hover:text-indigo-600 group-hover:rotate-45 transition-transform duration-300" />
      </button>

      {/* Floating Action Button: "+ Report" */}
      {!isRouteMode && (
        <button
          onClick={onOpenReport}
          className="absolute bottom-8 right-5 z-20 flex items-center gap-2 px-5 py-3.5 bg-[#0B0F2E] hover:bg-indigo-950 text-white font-bold text-sm rounded-full shadow-2xl transition-all active:scale-95 border border-indigo-500/30"
        >
          <Plus className="w-5 h-5 text-indigo-400" />
          <span>Report Hazard</span>
        </button>
      )}
    </div>
  );
}
