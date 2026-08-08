import { useState, useRef, useCallback } from 'react';

/**
 * Nominatim autocomplete hook.
 * Debounced 400ms, min 3 chars, AbortController per request to drop stale responses.
 * Returns: { suggestions, loading, search, clear }
 * Each suggestion: { label, shortLabel, lat, lng }
 */
export function useNominatimAutocomplete(userLocation = {}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef  = useRef(null);
  const controllerRef = useRef(null);

  const search = useCallback((query) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      // Abort any in-flight request
      if (controllerRef.current) controllerRef.current.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setLoading(true);
      try {
        const lat = userLocation.lat || 28.6328;
        const lng = userLocation.lng || 77.2195;
        // viewbox biased ±1° around user location
        const viewbox = `${lng - 1},${lat + 1},${lng + 1},${lat - 1}`;
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&viewbox=${viewbox}&bounded=0&limit=5`;

        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json();

        if (!Array.isArray(data)) { setSuggestions([]); return; }

        setSuggestions(data.map(item => {
          const parts = item.display_name.split(',');
          return {
            label: item.display_name,
            shortLabel: parts.slice(0, 3).join(', ').trim(),
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          };
        }));
      } catch (err) {
        if (err.name !== 'AbortError') setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, [userLocation.lat, userLocation.lng]);

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (controllerRef.current) controllerRef.current.abort();
    setSuggestions([]);
    setLoading(false);
  }, []);

  return { suggestions, loading, search, clear };
}
