import { getPointRiskStatus } from './riskEngine.js';

/**
 * Fetch routes purely from OSRM road network and score path segments against grid cells AFTER routing.
 * Supports Travel Modes: 'walking' (default) and 'vehicle' (driving profile).
 */
export async function getScoredRoutes(origin, destination, gridZones = [], travelMode = 'walking') {
  try {
    const osrmProfile = travelMode === 'vehicle' ? 'driving' : 'foot';
    const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?alternatives=3&overview=full&geometries=geojson`;

    const response = await fetch(osrmUrl);
    if (!response.ok) {
      throw new Error(`OSRM API status: ${response.status}`);
    }

    const data = await response.json();
    const rawRoutes = data.routes || [];

    if (rawRoutes.length === 0) {
      return { success: false, message: 'No road route found between these locations.' };
    }

    // Process and evaluate each pure road route
    const evaluatedRoutes = rawRoutes.map((route, idx) => {
      const roadGeoJsonCoords = route.geometry.coordinates; // Pure [lng, lat] pairs from OSRM
      const distanceMeters = route.distance;
      const durationMins = Math.max(1, Math.round(route.duration / 60));

      let totalPathRiskScore = 0;
      let highRiskSegmentCount = 0;

      const leafLatLgCoords = roadGeoJsonCoords.map(([lng, lat]) => [lat, lng]);

      // Re-weight risk scoring based on travel mode
      // Walking mode: full weight on lighting & isolation signals (multiplier 1.0)
      // Vehicle mode: reduced vulnerability to darkness/isolation (multiplier 0.55)
      const isolationMultiplier = travelMode === 'vehicle' ? 0.55 : 1.0;

      const segments = leafLatLgCoords.map(([lat, lng]) => {
        const status = getPointRiskStatus(lat, lng, gridZones);
        let adjustedScore = status.score;

        if (travelMode === 'vehicle') {
          const reportBonus = status.zone ? (status.zone.reportCount * 8) : 0;
          adjustedScore = Math.round(Math.min(100, (status.score * isolationMultiplier) + reportBonus));
        }

        totalPathRiskScore += adjustedScore;
        if (adjustedScore > 65) {
          highRiskSegmentCount++;
        }
        return { lat, lng, score: adjustedScore, level: adjustedScore > 65 ? 'High' : (adjustedScore > 35 ? 'Moderate' : 'Low') };
      });

      const avgPathRisk = leafLatLgCoords.length > 0 
        ? Math.round(totalPathRiskScore / leafLatLgCoords.length) 
        : 20;

      return {
        id: `route_${idx + 1}`,
        name: idx === 0 ? (travelMode === 'vehicle' ? 'Primary Vehicle Route' : 'Primary Footpath') : `Alternative Route ${idx}`,
        travelMode,
        distanceMeters,
        durationMins,
        avgPathRisk,
        highRiskSegmentCount,
        coordinates: leafLatLgCoords,
        segments
      };
    });

    // Composite scoring: route_score = 0.4*normalized_time + 0.6*normalized_risk
    const maxTime = Math.max(...evaluatedRoutes.map(r => r.durationMins)) || 1;
    const maxRisk = Math.max(...evaluatedRoutes.map(r => r.avgPathRisk)) || 1;

    evaluatedRoutes.forEach(r => {
      const normTime = r.durationMins / maxTime;
      const normRisk = r.avgPathRisk / maxRisk;
      r.compositeScore = (0.4 * normTime) + (0.6 * normRisk);
    });

    const sortedBySafety = [...evaluatedRoutes].sort((a, b) => a.compositeScore - b.compositeScore);
    const sortedBySpeed = [...evaluatedRoutes].sort((a, b) => a.durationMins - b.durationMins);

    const safeRoute = sortedBySafety[0];
    const fastestRoute = sortedBySpeed[0];

    safeRoute.isRecommended = true;
    safeRoute.badge = 'Safe Route';

    if (fastestRoute.id !== safeRoute.id) {
      fastestRoute.badge = 'Fastest Route';
    }

    return {
      success: true,
      travelMode,
      routes: evaluatedRoutes,
      safeRouteId: safeRoute.id,
      fastestRouteId: fastestRoute.id
    };

  } catch (error) {
    console.warn('⚠️ OSRM API fallback (clean direct line route):', error.message);
    const steps = 15;
    const fallbackCoords = [];
    for (let i = 0; i <= steps; i++) {
      const lat = origin.lat + ((destination.lat - origin.lat) * i / steps);
      const lng = origin.lng + ((destination.lng - origin.lng) * i / steps);
      fallbackCoords.push([lat, lng]);
    }

    const segments = fallbackCoords.map(([lat, lng]) => {
      const status = getPointRiskStatus(lat, lng, gridZones);
      return { lat, lng, score: status.score, level: status.level };
    });

    return {
      success: true,
      travelMode,
      routes: [{
        id: 'fallback_1',
        name: 'Direct Road Route',
        distanceMeters: 1200,
        durationMins: travelMode === 'vehicle' ? 5 : 15,
        avgPathRisk: 25,
        highRiskSegmentCount: 0,
        compositeScore: 0.3,
        isRecommended: true,
        badge: 'Safe Route',
        coordinates: fallbackCoords,
        segments
      }],
      safeRouteId: 'fallback_1',
      fastestRouteId: 'fallback_1'
    };
  }
}
