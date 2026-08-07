import { getPointRiskStatus } from './riskEngine.js';

// Average speeds for display context
const SPEED_KMPH = { walking: 5, vehicle: 35 };

/**
 * Fetch road routes from OSRM and score their geometry against risk zones.
 * Walking uses the foot profile; vehicle uses the driving profile.
 * OSRM returns accurate mode-specific duration and geometry.
 */
export async function getScoredRoutes(origin, destination, gridZones = [], travelMode = 'walking') {
  try {
    const osrmProfile = travelMode === 'vehicle' ? 'driving' : 'foot';
    const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?alternatives=3&overview=full&geometries=geojson`;

    const response = await fetch(osrmUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`OSRM API status: ${response.status}`);

    const json = await response.json();
    const rawRoutes = json.routes || [];
    if (rawRoutes.length === 0) return { success: false, message: 'No road route found between these locations.' };

    const isolationMultiplier = travelMode === 'vehicle' ? 0.55 : 1.0;

    const evaluatedRoutes = rawRoutes.map((route, idx) => {
      const coordinates = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

      // OSRM duration is in seconds, profile-specific (foot ≈ 5 km/h, driving ≈ actual road speed)
      const durationMins = Math.max(1, Math.round(route.duration / 60));
      const distanceKm = (route.distance / 1000).toFixed(1);

      let totalPathRiskScore = 0;
      let highRiskSegmentCount = 0;

      coordinates.forEach(([lat, lng]) => {
        const status = getPointRiskStatus(lat, lng, gridZones);
        const reportBonus = travelMode === 'vehicle' && status.zone ? status.zone.reportCount * 8 : 0;
        const score = travelMode === 'vehicle'
          ? Math.round(Math.min(100, (status.score * isolationMultiplier) + reportBonus))
          : status.score;
        totalPathRiskScore += score;
        if (score > 65) highRiskSegmentCount++;
      });

      const avgPathRisk = coordinates.length
        ? Math.round(totalPathRiskScore / coordinates.length)
        : 20;

      const routeName = idx === 0
        ? (travelMode === 'vehicle' ? 'Primary Road Route' : 'Primary Footpath')
        : `Alternative Route ${idx}`;

      return {
        id: `route_${idx + 1}`,
        name: routeName,
        travelMode,
        distanceMeters: route.distance,
        distanceKm,
        durationMins,
        avgPathRisk,
        highRiskSegmentCount,
        coordinates,
        // Speed context for display
        speedContext: travelMode === 'vehicle'
          ? `~${SPEED_KMPH.vehicle} km/h avg`
          : `~${SPEED_KMPH.walking} km/h walking`,
      };
    });

    // Composite score: 40% time weight + 60% safety weight
    const maxTime = Math.max(...evaluatedRoutes.map(r => r.durationMins)) || 1;
    const maxRisk = Math.max(...evaluatedRoutes.map(r => r.avgPathRisk)) || 1;
    evaluatedRoutes.forEach(r => {
      r.compositeScore = (0.4 * (r.durationMins / maxTime)) + (0.6 * (r.avgPathRisk / maxRisk));
    });

    const safeRoute = [...evaluatedRoutes].sort((a, b) => a.compositeScore - b.compositeScore)[0];
    const fastestRoute = [...evaluatedRoutes].sort((a, b) => a.durationMins - b.durationMins)[0];
    safeRoute.isRecommended = true;
    safeRoute.badge = 'Safe Route';
    if (fastestRoute.id !== safeRoute.id) fastestRoute.badge = 'Fastest Route';

    return {
      success: true,
      travelMode,
      routes: evaluatedRoutes,
      safeRouteId: safeRoute.id,
      fastestRouteId: fastestRoute.id
    };
  } catch (error) {
    console.warn('OSRM route request failed:', error.message);
    return {
      success: false,
      message: 'Routing is temporarily unavailable. Please try again.'
    };
  }
}
