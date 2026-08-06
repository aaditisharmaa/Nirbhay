import { getPointRiskStatus } from './riskEngine.js';

/**
 * Fetch road routes from OSRM and score their geometry against risk zones.
 */
export async function getScoredRoutes(origin, destination, gridZones = [], travelMode = 'walking') {
  try {
    const osrmProfile = travelMode === 'vehicle' ? 'driving' : 'foot';
    const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?alternatives=3&overview=full&geometries=geojson`;
    const response = await fetch(osrmUrl);
    if (!response.ok) throw new Error(`OSRM API status: ${response.status}`);

    const rawRoutes = (await response.json()).routes || [];
    if (rawRoutes.length === 0) return { success: false, message: 'No road route found between these locations.' };

    const evaluatedRoutes = rawRoutes.map((route, idx) => {
      const coordinates = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      const durationMins = Math.max(1, Math.round(route.duration / 60));
      const isolationMultiplier = travelMode === 'vehicle' ? 0.55 : 1;
      let totalPathRiskScore = 0;
      let highRiskSegmentCount = 0;

      const segments = coordinates.map(([lat, lng]) => {
        const status = getPointRiskStatus(lat, lng, gridZones);
        const reportBonus = travelMode === 'vehicle' && status.zone ? status.zone.reportCount * 8 : 0;
        const score = travelMode === 'vehicle'
          ? Math.round(Math.min(100, (status.score * isolationMultiplier) + reportBonus))
          : status.score;
        totalPathRiskScore += score;
        if (score > 65) highRiskSegmentCount++;
        return { lat, lng, score, level: score > 65 ? 'High' : (score > 35 ? 'Moderate' : 'Low') };
      });

      return {
        id: `route_${idx + 1}`,
        name: idx === 0 ? (travelMode === 'vehicle' ? 'Primary Vehicle Route' : 'Primary Footpath') : `Alternative Route ${idx}`,
        travelMode,
        distanceMeters: route.distance,
        durationMins,
        avgPathRisk: coordinates.length ? Math.round(totalPathRiskScore / coordinates.length) : 20,
        highRiskSegmentCount,
        coordinates,
        segments
      };
    });

    const maxTime = Math.max(...evaluatedRoutes.map(route => route.durationMins)) || 1;
    const maxRisk = Math.max(...evaluatedRoutes.map(route => route.avgPathRisk)) || 1;
    evaluatedRoutes.forEach(route => {
      route.compositeScore = (0.4 * (route.durationMins / maxTime)) + (0.6 * (route.avgPathRisk / maxRisk));
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
      message: 'Routing is temporarily unavailable. Do not rely on an estimated direct-line route.'
    };
  }
}
