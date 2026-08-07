/**
 * Sunrise-Sunset Service
 * Fetches actual sunrise/sunset times for a given lat/lng from the free
 * api.sunrise-sunset.org API (no key required, attribution: sunrise-sunset.org).
 * Results are cached for 12 hours to avoid hammering the API.
 */

const cache = new Map(); // key: "lat_lng_date" → { sunriseUTC, sunsetUTC, fetchedAt }
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Representative coordinates for each district — used as a single API call per district per day.
// Fetching once per district is sufficient since sunrise/sunset times vary < 2 min within a district.
const DISTRICT_COORDS = {
  Delhi:      { lat: 28.6139, lng: 77.2090 },
  Noida:      { lat: 28.5355, lng: 77.3910 },
  Lucknow:    { lat: 26.8467, lng: 80.9462 },
  Kanpur:     { lat: 26.4499, lng: 80.3319 },
  Agra:       { lat: 27.1767, lng: 78.0081 },
  Mathura:    { lat: 27.4924, lng: 77.6737 },
  Varanasi:   { lat: 25.2820, lng: 82.9984 },
  Mumbai:     { lat: 19.0760, lng: 72.8777 },
  Bangalore:  { lat: 12.9716, lng: 77.5946 },
  Kolkata:    { lat: 22.5726, lng: 88.3639 },
  Hyderabad:  { lat: 17.3850, lng: 78.4867 },
  Chennai:    { lat: 13.0827, lng: 80.2707 },
  Pune:       { lat: 18.5204, lng: 73.8567 },
  Ahmedabad:  { lat: 23.0225, lng: 72.5714 },
  default:    { lat: 28.6139, lng: 77.2090 }, // Delhi as fallback
};

/**
 * Returns true if the current UTC time is between sunrise and sunset
 * for the given district. Falls back to a simple hour-based heuristic
 * (6 AM – 7 PM IST) if the API call fails.
 */
export async function isDaytimeForDistrict(districtName) {
  const coords = DISTRICT_COORDS[districtName] || DISTRICT_COORDS.default;
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const cacheKey = `${districtName}_${todayStr}`;

  // Return cached result if still fresh
  if (cache.has(cacheKey)) {
    const entry = cache.get(cacheKey);
    if (Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
      return isCurrentlyDaytime(entry.sunriseUTC, entry.sunsetUTC);
    }
  }

  try {
    const url = `https://api.sunrise-sunset.org/json?lat=${coords.lat}&lng=${coords.lng}&date=${todayStr}&formatted=0`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`API status ${res.status}`);
    const data = await res.json();
    if (data.status !== 'OK') throw new Error('Non-OK status from sunrise API');

    const sunriseUTC = new Date(data.results.sunrise).getTime();
    const sunsetUTC  = new Date(data.results.sunset).getTime();

    cache.set(cacheKey, { sunriseUTC, sunsetUTC, fetchedAt: Date.now() });
    console.log(`☀️  Sunrise/sunset fetched for ${districtName}: rise=${new Date(sunriseUTC).toUTCString()}, set=${new Date(sunsetUTC).toUTCString()}`);
    return isCurrentlyDaytime(sunriseUTC, sunsetUTC);
  } catch (err) {
    console.warn(`⚠️  Sunrise API failed for ${districtName} — using hour fallback:`, err.message);
    return heuristicIsDaytime();
  }
}

function isCurrentlyDaytime(sunriseUTC, sunsetUTC) {
  const now = Date.now();
  return now >= sunriseUTC && now <= sunsetUTC;
}

// Simple IST-based fallback: 6 AM – 7 PM
function heuristicIsDaytime() {
  const istHour = (new Date().getUTCHours() + 5 + Math.floor((new Date().getUTCMinutes() + 30) / 60)) % 24;
  return istHour >= 6 && istHour < 19;
}

/**
 * Bulk-fetch sunrise/sunset for all districts at once — call once at server startup
 * to warm the cache so the first risk-score request is never slow.
 */
export async function warmSunriseSunsetCache() {
  console.log('☀️  Warming sunrise/sunset cache for all districts…');
  await Promise.allSettled(
    Object.keys(DISTRICT_COORDS).map(district => isDaytimeForDistrict(district))
  );
  console.log('☀️  Sunrise/sunset cache warm.');
}
