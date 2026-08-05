import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { Lock, MapPin, AlertTriangle, X, Search, Compass } from './Icons';
import { authenticatedHeaders } from '../utils/api';

export default function ReportModal({ userLocation, user, onClose, onReportSubmitted }) {
  const initialLat = userLocation.lat || 28.6328;
  const initialLng = userLocation.lng || 77.2195;

  const [selectedLocation, setSelectedLocation] = useState({ lat: initialLat, lng: initialLng });
  const [addressLabel, setAddressLabel] = useState(`${initialLat.toFixed(4)}, ${initialLng.toFixed(4)}`);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('Poor Lighting');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState(null);

  const miniMapRef = useRef(null);
  const leafletMiniMap = useRef(null);
  const markerRef = useRef(null);

  // Initialize interactive mini Leaflet map with draggable pin
  useEffect(() => {
    if (!miniMapRef.current || leafletMiniMap.current) return;

    const map = L.map(miniMapRef.current, {
      center: [initialLat, initialLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: 'custom-pin-drop',
      html: `
        <div class="w-8 h-8 rounded-full bg-[#0B0F2E] border-2 border-white text-indigo-400 flex items-center justify-center shadow-2xl cursor-grab active:cursor-grabbing transform -translate-x-1/2 -translate-y-1/2">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([initialLat, initialLng], { icon: pinIcon, draggable: true }).addTo(map);
    markerRef.current = marker;

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      updateSelectedLocation(pos.lat, pos.lng);
    });

    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      updateSelectedLocation(e.latlng.lat, e.latlng.lng);
    });

    leafletMiniMap.current = map;

    return () => {
      if (leafletMiniMap.current) {
        leafletMiniMap.current.remove();
        leafletMiniMap.current = null;
      }
    };
  }, []);

  const updateSelectedLocation = async (lat, lng) => {
    setSelectedLocation({ lat, lng });
    setAddressLabel(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      if (data && data.display_name) {
        const parts = data.display_name.split(',');
        const shortName = parts.slice(0, 3).join(',');
        setAddressLabel(shortName);
      }
    } catch (e) {}
  };

  // Item 4: Fast "Use My Current Location" Handler
  const handleUseCurrentLocation = () => {
    const geoOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setSelectedLocation({ lat, lng });
          if (leafletMiniMap.current && markerRef.current) {
            leafletMiniMap.current.setView([lat, lng], 16);
            markerRef.current.setLatLng([lat, lng]);
          }
          updateSelectedLocation(lat, lng);
        },
        () => {
          // Fallback to userLocation state
          const lat = userLocation.lat || 28.6328;
          const lng = userLocation.lng || 77.2195;
          setSelectedLocation({ lat, lng });
          if (leafletMiniMap.current && markerRef.current) {
            leafletMiniMap.current.setView([lat, lng], 16);
            markerRef.current.setLatLng([lat, lng]);
          }
          updateSelectedLocation(lat, lng);
        },
        geoOptions
      );
    }
  };

  const handleSearchAddress = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;

    setGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ', Delhi')}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const newLat = parseFloat(data[0].lat);
        const newLng = parseFloat(data[0].lon);
        
        setSelectedLocation({ lat: newLat, lng: newLng });
        setAddressLabel(data[0].display_name.split(',').slice(0, 3).join(','));

        if (leafletMiniMap.current && markerRef.current) {
          leafletMiniMap.current.setView([newLat, newLng], 16);
          markerRef.current.setLatLng([newLat, newLng]);
        }
      }
    } catch (err) {
      console.warn('Geocoding search error:', err);
    } finally {
      setGeocoding(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        userId: user ? user.id : 'anon_user',
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        category,
        description
      };

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: await authenticatedHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit report');
      }

      onReportSubmitted(data.zone);
      onClose();
    } catch (err) {
      console.error('Report submission error:', err);
      setError('Could not submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 border border-slate-100 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Report Safety Hazard</h3>
              <p className="text-[11px] text-slate-500 font-medium">Pin drop location picker enabled</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-3 text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Label Header */}
          <div className="p-3 bg-indigo-950 text-white rounded-2xl shadow-md border border-indigo-900 flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 overflow-hidden">
              <MapPin className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
              <div className="overflow-hidden">
                <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300">
                  Reporting For Location:
                </p>
                <p className="text-xs font-extrabold text-white truncate">
                  {addressLabel}
                </p>
              </div>
            </div>
          </div>

          {/* Item 4: "Use My Current Location" Action Button */}
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-all flex items-center justify-center gap-1.5 active:scale-98"
          >
            <Compass className="w-4 h-4 text-indigo-600 animate-spin" style={{ animationDuration: '6s' }} />
            <span>Use My Current GPS Location</span>
          </button>

          {/* Location Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search specific landmark or address..."
              className="w-full pl-3 pr-20 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={handleSearchAddress}
              disabled={geocoding || !searchQuery}
              className="absolute right-1 top-1 bottom-1 px-3 bg-[#0B0F2E] hover:bg-indigo-950 text-white text-[11px] font-bold rounded-lg transition-all"
            >
              {geocoding ? 'Finding...' : 'Set Pin'}
            </button>
          </div>

          {/* Interactive Mini Map Pin Dropper */}
          <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
            <div ref={miniMapRef} className="w-full h-full" />
            <div className="absolute top-2 right-2 z-10 px-2 py-1 bg-white/90 backdrop-blur-md rounded-lg text-[10px] font-bold text-slate-700 shadow-sm border border-slate-200">
              Drag pin to move
            </div>
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Incident Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Poor Lighting">Poor Lighting / Darkness</option>
              <option value="Harassment">Harassment / Catcalling</option>
              <option value="Stalking">Stalking / Followed</option>
              <option value="Deserted Area">Deserted / Secluded Stretch</option>
              <option value="Other">Other Safety Hazard</option>
            </select>
          </div>

          {/* Free Text Description Box */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you observed at this location..."
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
            />
          </div>

          {/* Anonymity Banner */}
          <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 p-2 rounded-xl">
            <Lock className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-slate-600 leading-snug">
              <span className="font-bold text-slate-900">100% Anonymous:</span> Your name is never shown publicly on this report.
            </p>
          </div>

          {/* Submit Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-[#0B0F2E] hover:bg-indigo-950 rounded-xl shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Report at Pin'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
