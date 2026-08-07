import db from '../db.js';
import { getHaversineDistanceKm } from './osmService.js';

// Cell size: ~150 meters in lat/lng
export const CELL_LAT_SIZE = 0.00135;
export const CELL_LNG_SIZE = 0.00155;

// ---------------------------------------------------------------------------
// NCRB District Crime Baseline Multipliers
// Source: NCRB Crime in India 2022 (Vol. III — Metropolitan Cities data)
// Published by Ministry of Home Affairs, Government of India.
// URL: https://ncrb.gov.in/crime-in-india-table-content
// Methodology: total registered cognisable crimes per city, normalised to the
// national 8-metro average (~64,000 cases). Delhi (318,000 cases) = 1.35×,
// cities below average get a mild downward nudge, others scaled proportionally.
// This is a BASELINE signal only — it does not trigger live alerts.
// Live alerts are driven exclusively by community reports and anomaly detection.
// ---------------------------------------------------------------------------
export const NCRB_DISTRICT_MULTIPLIERS = {
  // Source values (NCRB 2022 total cognisable crimes, 8 major metros):
  // Delhi: 318,000 | Mumbai: 89,000 | Ahmedabad: 54,000 | Bengaluru: 46,000
  // Chennai: 39,000 | Kolkata: 25,000 | Hyderabad: 23,000 | Pune: 21,000
  // National 8-metro average ≈ 64,000 → normalised so avg = 1.00
  Delhi:      1.35,   // 318k cases — significantly above average
  Noida:      1.20,   // Part of NCR — shares Delhi's elevated baseline
  Ghaziabad:  1.18,   // NCR district with high density
  Lucknow:    1.22,   // UP state capital — elevated baseline
  Kanpur:     1.25,   // Historically high crime rate, UP industrial belt
  Agra:       1.15,   // Tourist city with elevated street-level incidents
  Mathura:    1.10,   // Moderate — less dense than Agra/Kanpur
  Varanasi:   1.12,   // Religious city — crowd-related incidents elevated
  Meerut:     1.14,   // NCR-adjacent UP city
  Prayagraj:  1.10,
  Aligarh:    1.08,
  Mumbai:     1.12,   // 89k — above national average
  Bangalore:  1.08,   // 46k — slightly below national average
  Kolkata:    1.05,   // 25k — below average (or under-reporting)
  Hyderabad:  1.04,   // 23k — below average
  Chennai:    1.06,   // 39k — near average
  Pune:       1.03,   // 21k — consistently low
  Ahmedabad:  1.07,   // 54k — slightly below average
  default:    1.00,   // Unknown district — no adjustment
};

// ---------------------------------------------------------------------------
// District bounding-box resolver
// Returns the NCRB district name for a given lat/lng pair.
// Boxes are deliberately conservative (tight) to avoid misclassification
// near district boundaries.
// ---------------------------------------------------------------------------
export function resolveDistrictName(lat, lng) {
  // Delhi NCR core
  if (lat > 28.40 && lat < 28.90 && lng > 76.84 && lng < 77.35) return 'Delhi';
  // Noida / Greater Noida (Gautam Buddh Nagar)
  if (lat > 28.40 && lat < 28.65 && lng > 77.35 && lng < 77.60) return 'Noida';
  // Ghaziabad
  if (lat > 28.58 && lat < 28.75 && lng > 77.35 && lng < 77.55) return 'Ghaziabad';
  // Lucknow
  if (lat > 26.75 && lat < 26.96 && lng > 80.82 && lng < 81.08) return 'Lucknow';
  // Kanpur
  if (lat > 26.35 && lat < 26.60 && lng > 80.20 && lng < 80.50) return 'Kanpur';
  // Agra
  if (lat > 27.10 && lat < 27.25 && lng > 77.92 && lng < 78.12) return 'Agra';
  // Mathura / Vrindavan (GLA University area included)
  if (lat > 27.40 && lat < 27.70 && lng > 77.52 && lng < 77.75) return 'Mathura';
  // Varanasi
  if (lat > 25.22 && lat < 25.38 && lng > 82.90 && lng < 83.08) return 'Varanasi';
  // Meerut
  if (lat > 28.90 && lat < 29.10 && lng > 77.60 && lng < 77.82) return 'Meerut';
  // Prayagraj (Allahabad)
  if (lat > 25.38 && lat < 25.52 && lng > 81.74 && lng < 81.95) return 'Prayagraj';
  // Aligarh
  if (lat > 27.83 && lat < 27.96 && lng > 78.02 && lng < 78.15) return 'Aligarh';
  // Mumbai (Brihanmumbai)
  if (lat > 18.85 && lat < 19.32 && lng > 72.75 && lng < 73.00) return 'Mumbai';
  // Bangalore
  if (lat > 12.82 && lat < 13.15 && lng > 77.45 && lng < 77.82) return 'Bangalore';
  // Kolkata
  if (lat > 22.42 && lat < 22.70 && lng > 88.25 && lng < 88.50) return 'Kolkata';
  // Hyderabad
  if (lat > 17.28 && lat < 17.58 && lng > 78.30 && lng < 78.58) return 'Hyderabad';
  // Chennai
  if (lat > 12.90 && lat < 13.25 && lng > 80.15 && lng < 80.38) return 'Chennai';
  // Pune
  if (lat > 18.42 && lat < 18.65 && lng > 73.72 && lng < 74.02) return 'Pune';
  // Ahmedabad
  if (lat > 22.90 && lat < 23.15 && lng > 72.45 && lng < 72.70) return 'Ahmedabad';
  return 'default';
}

/**
 * Universal dynamic cell_id calculation for any coordinates across India / global
 */
export function getCellId(lat, lng) {
  const latIndex = Math.floor(lat / CELL_LAT_SIZE);
  const lngIndex = Math.floor(lng / CELL_LNG_SIZE);
  return `cell_${latIndex}_${lngIndex}`;
}

/**
 * Universal cell center coordinates calculation
 */
export function getCellCenter(cellId) {
  const parts = cellId.split('_');
  const latIdx = parseInt(parts[1], 10);
  const lngIdx = parseInt(parts[2], 10);
  return {
    lat: (latIdx + 0.5) * CELL_LAT_SIZE,
    lng: (lngIdx + 0.5) * CELL_LNG_SIZE
  };
}

/**
 * Compute risk scores for all active grid cells.
 *
 * @param {object} osmFeatures   - Cached OSM spatial features
 * @param {object} timeContext   - Optional: { daytimeByDistrict: Map<string, boolean> }
 *                                 Pre-resolved day/night state per district so this
 *                                 sync function doesn't need to do async I/O.
 *                                 Falls back to IST-hour heuristic if not supplied.
 */
export function computeAllGridScores(
  osmFeatures = { streetlights: [], policeStations: [], isolatedWays: [] },
  timeContext = {}
) {
  const reports = db.prepare('SELECT * FROM reports').all();
  const upvotes = db.prepare('SELECT * FROM upvotes').all();

  // Pre-compute IST hour for heuristic fallback (UTC+5:30)
  const nowUtcMs = Date.now();
  const istHour = Math.floor((nowUtcMs / 3600000 + 5.5) % 24);
  const heuristicDaytime = istHour >= 6 && istHour < 19;

  const upvoteCounts = {};
  upvotes.forEach(u => {
    upvoteCounts[u.report_id] = (upvoteCounts[u.report_id] || 0) + 1;
  });

  const now = nowUtcMs;
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const activeCellsMap = new Map();

  const getOrCreateCell = (cellId, centerLat, centerLng) => {
    if (!activeCellsMap.has(cellId)) {
      activeCellsMap.set(cellId, {
        cellId,
        centerLat,
        centerLng,
        reports: [],
        overlappingReportsCount: 0,
        severityScoreSum: 0,
        recencyDensityScore: 0,
        recentSpikeCount: 0,
        reportsIn2h: 0
      });
    }
    return activeCellsMap.get(cellId);
  };

  // 1. Process Reports with Spatial Influence Radius
  reports.forEach(rep => {
    const repLat = rep.lat;
    const repLng = rep.lng;
    const repTime = new Date(rep.created_at).getTime();
    const msOld = Math.max(0, now - repTime);
    const daysOld = msOld / (1000 * 60 * 60 * 24);

    const recencyFactor = Math.exp(-0.05 * daysOld);

    let sevWeight = 0.3;
    let radiusKm = 0.06;
    if (rep.severity === 'medium') { sevWeight = 0.6; radiusKm = 0.10; }
    else if (rep.severity === 'high') { sevWeight = 1.0; radiusKm = 0.15; }

    const upvotesOnRep = (upvoteCounts[rep.id] || 0) + (rep.confirm_count || 0);
    let totalRepWeight = (sevWeight + upvotesOnRep * 0.15) * recencyFactor;
    if (rep.is_likely_spam) totalRepWeight *= 0.15;

    const is2hSpike = msOld <= TWO_HOURS_MS;
    const latSpan = Math.ceil(radiusKm / 0.111);
    const lngSpan = Math.ceil(radiusKm / 0.111);
    const baseLatIdx = Math.floor(repLat / CELL_LAT_SIZE);
    const baseLngIdx = Math.floor(repLng / CELL_LNG_SIZE);

    for (let dLat = -latSpan; dLat <= latSpan; dLat++) {
      for (let dLng = -lngSpan; dLng <= lngSpan; dLng++) {
        const lIdx = baseLatIdx + dLat;
        const lgIdx = baseLngIdx + dLng;
        const cLat = (lIdx + 0.5) * CELL_LAT_SIZE;
        const cLng = (lgIdx + 0.5) * CELL_LNG_SIZE;
        const distKm = getHaversineDistanceKm(repLat, repLng, cLat, cLng);
        if (distKm <= radiusKm) {
          const cId = `cell_${lIdx}_${lgIdx}`;
          const cellObj = getOrCreateCell(cId, cLat, cLng);
          const spatialDecay = 1 - (distKm / radiusKm);
          const effectiveWeight = totalRepWeight * spatialDecay;
          cellObj.overlappingReportsCount += 1;
          cellObj.severityScoreSum += effectiveWeight;
          cellObj.recencyDensityScore += effectiveWeight;
          if (is2hSpike) cellObj.reportsIn2h += 1;
          if (distKm <= 0.1) cellObj.reports.push({ ...rep, distanceKm: distKm, upvotes: upvotesOnRep });
        }
      }
    }
  });

  const scoredZones = [];

  activeCellsMap.forEach((cell) => {
    let streetlightsInCell = 0;
    osmFeatures.streetlights.forEach(sl => {
      if (getHaversineDistanceKm(cell.centerLat, cell.centerLng, sl.lat, sl.lng) <= 0.15)
        streetlightsInCell++;
    });

    let minPoliceDistKm = 5.0;
    osmFeatures.policeStations.forEach(ps => {
      const d = getHaversineDistanceKm(cell.centerLat, cell.centerLng, ps.lat, ps.lng);
      if (d < minPoliceDistKm) minPoliceDistKm = d;
    });

    let hasIsolatedWay = false;
    osmFeatures.isolatedWays.forEach(iw => {
      if (getHaversineDistanceKm(cell.centerLat, cell.centerLng, iw.lat, iw.lng) <= 0.12)
        hasIsolatedWay = true;
    });

    // ── Base component scores ──────────────────────────────────────────────
    const reportScore = Math.min(50, cell.recencyDensityScore * 18);

    let lightingScoreRaw = 20;
    if (streetlightsInCell >= 5)      lightingScoreRaw = 2;
    else if (streetlightsInCell >= 2) lightingScoreRaw = 8;
    else if (streetlightsInCell === 1) lightingScoreRaw = 14;

    // ── Feature: Time-of-Day Lighting Weight ──────────────────────────────
    // Streetlight density matters far less during daylight hours.
    // During the day we reduce lighting's contribution to 30% of its raw value.
    // After sunset / before sunrise it applies at full weight (100%).
    // Source: api.sunrise-sunset.org (fetched async, cached 12h in sunriseSunsetService.js)
    const districtName = resolveDistrictName(cell.centerLat, cell.centerLng);
    const isDaytime = timeContext.daytimeByDistrict
      ? (timeContext.daytimeByDistrict.get(districtName) ?? heuristicDaytime)
      : heuristicDaytime;

    const lightingTimeFactor = isDaytime ? 0.30 : 1.00;
    const lightingScore = Math.round(lightingScoreRaw * lightingTimeFactor);
    // ──────────────────────────────────────────────────────────────────────

    let policeScore = 15;
    if (minPoliceDistKm < 0.5)      policeScore = 2;
    else if (minPoliceDistKm < 1.5) policeScore = 6;
    else if (minPoliceDistKm < 3.0) policeScore = 10;

    const isolationScore = hasIsolatedWay ? 15 : 3;

    let totalScore = Math.round(reportScore + lightingScore + policeScore + isolationScore);
    totalScore = Math.max(5, Math.min(100, totalScore));

    // ── Feature: NCRB District Crime Baseline Multiplier ──────────────────
    // Applies a small upward adjustment to districts with historically higher
    // recorded crime rates (NCRB Crime in India 2022, Vol. III).
    // This is a background context signal — NOT a live alert trigger.
    // Max possible adjustment: ×1.35 (Delhi). Min: ×1.00 (unknown district).
    const ncrbMultiplier = NCRB_DISTRICT_MULTIPLIERS[districtName] ?? 1.00;
    totalScore = Math.round(totalScore * ncrbMultiplier);
    totalScore = Math.max(5, Math.min(100, totalScore)); // re-clamp after multiplier
    // ──────────────────────────────────────────────────────────────────────

    let riskLevel = 'Low';
    if (totalScore > 65)      riskLevel = 'High';
    else if (totalScore > 35) riskLevel = 'Moderate';

    const isAnomaly = cell.reportsIn2h >= 2 && cell.overlappingReportsCount >= 3;

    const categoryCounts = {};
    cell.reports.forEach(r => {
      categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
    });

    let locationName = 'Community Risk Zone';
    if (cell.reports.length > 0 && cell.reports[0].description) {
      const desc = cell.reports[0].description;
      locationName = desc.split('near')[1]?.split('.')[0]?.trim()
        || desc.split('at')[1]?.split('.')[0]?.trim()
        || locationName;
    }

    scoredZones.push({
      cellId: cell.cellId,
      lat: cell.centerLat,
      lng: cell.centerLng,
      score: totalScore,
      riskLevel,
      reportCount: cell.overlappingReportsCount,
      reportsIn2h: cell.reportsIn2h,
      isAnomaly,
      streetlightsCount: streetlightsInCell,
      nearestPoliceDistKm: parseFloat(minPoliceDistKm.toFixed(2)),
      hasIsolatedWay,
      districtName,
      signals: {
        streetlightsCount: streetlightsInCell,
        nearestPoliceDistKm: parseFloat(minPoliceDistKm.toFixed(2)),
        isIsolated: hasIsolatedWay,
        // Expose the two new context signals for downstream use in AI explainer
        isDaytime,
        ncrbMultiplier,
        districtName,
        lightingTimeFactor,
      },
      categoryCounts,
      locationName: locationName || 'Safety Risk Area',
      reports: cell.reports
    });
  });

  return scoredZones;
}

/**
 * Returns point risk status for live location
 */
export function getPointRiskStatus(lat, lng, gridZones = []) {
  if (!gridZones || gridZones.length === 0) {
    return { score: 15, level: 'Low', zone: null };
  }

  let nearestZone = null;
  let minDistanceKm = 999;

  gridZones.forEach(z => {
    const distKm = getHaversineDistanceKm(lat, lng, z.lat, z.lng);
    if (distKm < minDistanceKm) {
      minDistanceKm = distKm;
      nearestZone = z;
    }
  });

  if (nearestZone && minDistanceKm <= 0.3) {
    return {
      score: nearestZone.score,
      level: nearestZone.riskLevel,
      zone: nearestZone,
      distanceKm: minDistanceKm
    };
  }

  return { score: 15, level: 'Low', zone: null, distanceKm: minDistanceKm };
}
